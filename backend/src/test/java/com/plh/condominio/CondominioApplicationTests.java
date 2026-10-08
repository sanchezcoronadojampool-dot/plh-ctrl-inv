package com.plh.condominio;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.plh.condominio.dto.LoanItemRequest;
import com.plh.condominio.dto.LoanRequest;
import com.plh.condominio.dto.LoanReturnItemRequest;
import com.plh.condominio.dto.LoanReturnRequest;
import com.plh.condominio.dto.LoanResponse;
import com.plh.condominio.dto.MovementRequest;
import com.plh.condominio.dto.ProductRequest;
import com.plh.condominio.entity.AssetStatus;
import com.plh.condominio.entity.InventoryAsset;
import com.plh.condominio.entity.ItemCondition;
import com.plh.condominio.entity.MovementPurpose;
import com.plh.condominio.entity.MovementType;
import com.plh.condominio.entity.Product;
import com.plh.condominio.entity.StorageArea;
import com.plh.condominio.entity.User;
import com.plh.condominio.entity.TrackingType;
import com.plh.condominio.repository.AreaRepository;
import com.plh.condominio.repository.AssetRepository;
import com.plh.condominio.repository.LoanRepository;
import com.plh.condominio.repository.ProductRepository;
import com.plh.condominio.repository.UserRepository;
import com.plh.condominio.repository.InventoryStockLedgerRepository;
import com.plh.condominio.service.InventoryOperationsService;
import com.plh.condominio.service.InventoryService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles({"h2", "demo"})
class CondominioApplicationTests {

	@Autowired
	private LoanRepository loanRepository;

	@Autowired
	private InventoryOperationsService operationsService;

	@Autowired
	private InventoryService inventoryService;

	@Autowired
	private ProductRepository productRepository;

	@Autowired
	private AssetRepository assetRepository;

	@Autowired
	private AreaRepository areaRepository;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private InventoryStockLedgerRepository stockLedgerRepository;

	@Test
	void contextLoads() {
	}

	@Test
	void loadsLoansWithoutFetchingMultipleBagCollections() {
		assertDoesNotThrow(() -> loanRepository.findAllByOrderByIssuedAtDesc());
	}

	@Test
	@Transactional
	void doesNotAllowTrackingTypeChangesAfterInventoryMovements() {
		Product product = productRepository.findByCode("P-1001").orElseThrow();
		ProductRequest changeTracking = new ProductRequest(product.getCode(), product.getName(),
				product.getCategory(), product.getStock(), product.getMinimumStock(), product.getLocation(),
				product.getUnit(), TrackingType.ASSET);

		assertThrows(IllegalArgumentException.class,
				() -> inventoryService.updateProduct(product.getId(), changeTracking));
	}

	@Test
	void rejectsOversizedSerializedAssetQuantityAsValidationError() {
		User borrower = findUser("Residente");
		User operator = findUser("Encargado");
		StorageArea area = findArea("Cámaras");
		Product television = productRepository.findByCode("P-1001").orElseThrow();
		assertThrows(IllegalArgumentException.class, () -> operationsService.issueLoan(new LoanRequest(
				borrower.getId(), operator.getId(), area.getId(), "Préstamo de prueba", null,
				List.of(new LoanItemRequest(television.getId(), new BigDecimal("2147483648"),
						ItemCondition.GOOD, List.of())))));
	}

	@Test
	@Transactional
	void issuesAndPartiallyReturnsReusableLoanWithConditions() {
		User borrower = findUser("Residente");
		User operator = findUser("Encargado");
		StorageArea area = findArea("Almacén");
		Product tool = productRepository.findByCode("P-1002").orElseThrow();
		LoanResponse issued = operationsService.issueLoan(new LoanRequest(
				borrower.getId(), operator.getId(), area.getId(), "Mantenimiento de jardín", null,
				List.of(new LoanItemRequest(tool.getId(), BigDecimal.ONE, ItemCondition.GOOD, List.of()))));

		assertEquals(0, new BigDecimal("1.000").compareTo(issued.items().getFirst().outstandingQuantity()));
		LoanResponse partial = operationsService.returnLoan(issued.id(), new LoanReturnRequest(
				operator.getId(), borrower.getId(), area.getId(),
				List.of(new LoanReturnItemRequest(issued.items().getFirst().id(),
						new BigDecimal("0.500"), ItemCondition.FAIR, List.of()))));

		assertEquals(0, new BigDecimal("0.500").compareTo(partial.items().getFirst().outstandingQuantity()));
		assertEquals("PARTIALLY_RETURNED", partial.status().name());
		LoanResponse closed = operationsService.returnLoan(issued.id(), new LoanReturnRequest(
				operator.getId(), borrower.getId(), area.getId(),
				List.of(new LoanReturnItemRequest(issued.items().getFirst().id(),
						new BigDecimal("0.500"), ItemCondition.GOOD, List.of()))));
		assertEquals("CLOSED", closed.status().name());
		assertEquals(0, new BigDecimal("4.000").compareTo(productRepository.findById(tool.getId()).orElseThrow().getStock()));
	}

	@Test
	@Transactional
	void loansAndReturnsSerializedAssetWithQrHistory() {
		User borrower = findUser("Residente");
		User operator = findUser("Encargado");
		StorageArea area = findArea("Cámaras");
		InventoryAsset asset = assetRepository.findAllByOrderByAssetCodeAsc().stream()
				.filter(candidate -> candidate.getAssetCode().equals("TV-PLH-001")).findFirst().orElseThrow();
		BigDecimal expectedAvailable = BigDecimal.valueOf(assetRepository.countByProduct_IdAndStatusIn(
				asset.getProduct().getId(), List.of(AssetStatus.IN_STOCK, AssetStatus.ASSIGNED)));
		BigDecimal reportedAvailable = inventoryService.getProducts().stream()
				.filter(product -> product.id().equals(asset.getProduct().getId())).findFirst().orElseThrow()
				.availableStock();
		assertEquals(0, expectedAvailable.compareTo(reportedAvailable));
		LoanResponse issued = operationsService.issueLoan(new LoanRequest(
				borrower.getId(), operator.getId(), area.getId(), "Inspección temporal", null,
				List.of(new LoanItemRequest(asset.getProduct().getId(), BigDecimal.ONE,
						ItemCondition.GOOD, List.of(asset.getId())))));

		assertEquals(AssetStatus.ON_LOAN, issued.items().getFirst().assets().getFirst().status());
		assertEquals(List.of(), inventoryService.reconcileStockLedger());
		LoanResponse returned = operationsService.returnLoan(issued.id(), new LoanReturnRequest(
				operator.getId(), borrower.getId(), area.getId(),
				List.of(new LoanReturnItemRequest(issued.items().getFirst().id(), BigDecimal.ONE,
						ItemCondition.FAIR, List.of(asset.getId())))));

		assertEquals("CLOSED", returned.status().name());
		var qrDetail = operationsService.getAssetByQr(asset.getQrToken());
		assertEquals(AssetStatus.IN_STOCK, qrDetail.asset().status());
		assertEquals(ItemCondition.FAIR, qrDetail.asset().condition());
		assertEquals(3, qrDetail.history().size());
	}

	@Test
	@Transactional
	void recordsFractionalFuelAndQrAssetHistory() {
		User operator = findUser("Encargado");
		StorageArea area = findArea("Vehículos");
		Product fuel = productRepository.findByCode("P-4001").orElseThrow();
		assertThrows(IllegalArgumentException.class, () -> inventoryService.createMovement(
				new MovementRequest(fuel.getId(), operator.getId(), operator.getId(), area.getId(),
						MovementType.SALIDA, new BigDecimal("0.500"), " ", null,
						MovementPurpose.FUEL_USE, "Generador", ItemCondition.GOOD)));
		inventoryService.createMovement(new MovementRequest(fuel.getId(), operator.getId(), operator.getId(),
				area.getId(), MovementType.SALIDA, new BigDecimal("0.500"), "Generador de emergencia",
				null, MovementPurpose.FUEL_USE, "Generador", ItemCondition.GOOD));

		assertEquals(0, new BigDecimal("49.500").compareTo(productRepository.findById(fuel.getId()).orElseThrow().getStock()));
		var ledgerEntry = stockLedgerRepository.findAllByProduct_IdOrderByCreatedAtDescIdDesc(fuel.getId()).getFirst();
		assertEquals(0, new BigDecimal("-0.500").compareTo(ledgerEntry.getQuantityDelta()));
		assertEquals(0, new BigDecimal("49.500").compareTo(ledgerEntry.getBalanceAfter()));
		assertEquals(List.of(), inventoryService.reconcileStockLedger());
		InventoryAsset television = assetRepository.findAllByOrderByAssetCodeAsc().stream()
				.filter(asset -> asset.getAssetCode().equals("TV-PLH-001")).findFirst().orElseThrow();
		var qrDetail = operationsService.getAssetByQr(television.getQrToken());
		assertEquals(AssetStatus.ASSIGNED, qrDetail.asset().status());
		assertFalse(qrDetail.history().isEmpty());
	}

	private User findUser(String rolePart) {
		return userRepository.findAll().stream().filter(user -> user.getJobTitle().contains(rolePart))
				.findFirst().orElseThrow();
	}

	private StorageArea findArea(String name) {
		return areaRepository.findAllByActiveTrueOrderByNameAsc().stream()
				.filter(area -> area.getName().equals(name)).findFirst().orElseThrow();
	}

}
