package com.plh.condominio.service;

import com.plh.condominio.dto.AreaRequest;
import com.plh.condominio.dto.AreaResponse;
import com.plh.condominio.dto.AssetAssignRequest;
import com.plh.condominio.dto.AssetRequest;
import com.plh.condominio.dto.AssetResponse;
import com.plh.condominio.dto.LoanItemRequest;
import com.plh.condominio.dto.LoanLineResponse;
import com.plh.condominio.dto.LoanRequest;
import com.plh.condominio.dto.LoanResponse;
import com.plh.condominio.dto.LoanReturnItemRequest;
import com.plh.condominio.dto.LoanReturnRequest;
import com.plh.condominio.dto.MovementResponse;
import com.plh.condominio.dto.QrAssetDetailResponse;
import com.plh.condominio.entity.AssetStatus;
import com.plh.condominio.entity.InventoryAsset;
import com.plh.condominio.entity.ItemCondition;
import com.plh.condominio.entity.Loan;
import com.plh.condominio.entity.LoanAsset;
import com.plh.condominio.entity.LoanLine;
import com.plh.condominio.entity.LoanStatus;
import com.plh.condominio.entity.Movement;
import com.plh.condominio.entity.MovementPurpose;
import com.plh.condominio.entity.MovementType;
import com.plh.condominio.entity.Product;
import com.plh.condominio.entity.StorageArea;
import com.plh.condominio.entity.TrackingType;
import com.plh.condominio.entity.User;
import com.plh.condominio.repository.AreaRepository;
import com.plh.condominio.repository.AssetRepository;
import com.plh.condominio.repository.LoanLineRepository;
import com.plh.condominio.repository.LoanRepository;
import com.plh.condominio.repository.MovementRepository;
import com.plh.condominio.repository.ProductRepository;
import com.plh.condominio.repository.UserRepository;
import com.plh.condominio.security.AuthenticatedUser;
import jakarta.persistence.EntityNotFoundException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
public class InventoryOperationsService {

    private final AreaRepository areaRepository;
    private final AssetRepository assetRepository;
    private final LoanRepository loanRepository;
    private final LoanLineRepository loanLineRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final MovementRepository movementRepository;
    private final InventoryService inventoryService;

    public InventoryOperationsService(AreaRepository areaRepository, AssetRepository assetRepository,
            LoanRepository loanRepository, LoanLineRepository loanLineRepository, ProductRepository productRepository,
            UserRepository userRepository, MovementRepository movementRepository, InventoryService inventoryService) {
        this.areaRepository = areaRepository;
        this.assetRepository = assetRepository;
        this.loanRepository = loanRepository;
        this.loanLineRepository = loanLineRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.movementRepository = movementRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public List<AreaResponse> getAreas() {
        return areaRepository.findAllByActiveTrueOrderByNameAsc().stream().map(this::toAreaResponse).toList();
    }

    @Transactional
    public AreaResponse createArea(AreaRequest request) {
        StorageArea area = StorageArea.builder().name(request.name().trim())
                .description(request.description()).active(true).build();
        return toAreaResponse(areaRepository.save(area));
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> getAssets() {
        return assetRepository.findAllByOrderByAssetCodeAsc().stream().map(this::toAssetResponse).toList();
    }

    @Transactional
    public AssetResponse registerAsset(AssetRequest request) {
        Product product = productRepository.findByIdForUpdate(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + request.productId()));
        if (product.getTrackingType() != TrackingType.ASSET) {
            throw new IllegalArgumentException("Solo los productos configurados como activo individual pueden tener etiquetas QR unitarias.");
        }
        if (assetRepository.existsByAssetCode(request.assetCode().trim())) {
            throw new IllegalArgumentException("El código de activo ya está registrado.");
        }
        long existing = assetRepository.countByProduct_IdAndStatusNot(product.getId(), AssetStatus.RETIRED);
        if (BigDecimal.valueOf(existing + 1).compareTo(product.getStock()) > 0) {
            throw new IllegalArgumentException("Registra primero la existencia de compra del producto; no puedes etiquetar más unidades que las existentes.");
        }
        StorageArea area = findArea(request.areaId());
        User responsible = findUser(request.responsibleId());
        User recorder = currentActor(request.recordedById());
        InventoryAsset asset = InventoryAsset.builder()
                .product(product)
                .assetCode(request.assetCode().trim())
                .serialNumber(request.serialNumber())
                .area(area)
                .responsible(responsible)
                .condition(request.condition())
                .status(AssetStatus.ASSIGNED)
                .build();
        asset = assetRepository.save(asset);
        saveAssetMovement(asset, recorder, responsible, area, MovementPurpose.ASSET_ASSIGNMENT,
                MovementType.SALIDA, request.condition(), request.condition(), "Registro y asignación inicial");
        return toAssetResponse(asset);
    }

    @Transactional
    public AssetResponse assignAsset(Long id, AssetAssignRequest request) {
        InventoryAsset asset = assetRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new EntityNotFoundException("Activo no encontrado: " + id));
        if (asset.getStatus() == AssetStatus.ON_LOAN || asset.getStatus() == AssetStatus.RETIRED) {
            throw new IllegalStateException("No se puede asignar un activo prestado o retirado.");
        }
        StorageArea area = findArea(request.areaId());
        User responsible = findUser(request.responsibleId());
        User recorder = currentActor(request.issuedById());
        ItemCondition previousCondition = asset.getCondition();
        asset.setArea(area);
        asset.setResponsible(responsible);
        asset.setCondition(request.condition());
        asset.setStatus(AssetStatus.ASSIGNED);
        assetRepository.save(asset);
        saveAssetMovement(asset, recorder, responsible, area, MovementPurpose.ASSET_ASSIGNMENT,
                MovementType.SALIDA, previousCondition, request.condition(), request.reason());
        return toAssetResponse(asset);
    }

    @Transactional(readOnly = true)
    public QrAssetDetailResponse getAssetByQr(String token) {
        InventoryAsset asset = assetRepository.findByQrToken(token)
                .orElseThrow(() -> new EntityNotFoundException("El QR no corresponde a un activo registrado."));
        List<MovementResponse> history = movementRepository
                .findAllByAsset_IdOrderByMovementDateDescCreatedAtDesc(asset.getId()).stream()
                .map(inventoryService::toMovementResponse).toList();
        return new QrAssetDetailResponse(toAssetResponse(asset), history);
    }

    @Transactional(readOnly = true)
    public List<LoanResponse> getLoans() {
        return loanRepository.findAllByOrderByIssuedAtDesc().stream().map(this::toLoanResponse).toList();
    }

    @Transactional
    public LoanResponse issueLoan(LoanRequest request) {
        if (request.dueAt() != null && request.dueAt().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha límite del préstamo no puede estar en el pasado.");
        }
        User borrower = findUser(request.borrowerId());
        User issuer = currentActor(request.issuedById());
        StorageArea area = findArea(request.areaId());
        Loan loan = Loan.builder()
                .loanNumber("PLH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .borrower(borrower).issuedBy(issuer).area(area).purpose(request.purpose().trim())
                .issuedAt(LocalDate.now()).dueAt(request.dueAt()).status(LoanStatus.OPEN).build();
        loan = loanRepository.save(loan);
        Set<Long> processedAssetIds = new HashSet<>();

        for (LoanItemRequest item : request.items()) {
            Product product = productRepository.findByIdForUpdate(item.productId())
                    .orElseThrow(() -> new EntityNotFoundException("Producto no encontrado: " + item.productId()));
            if (!product.getActive()) throw new IllegalArgumentException("El producto está inactivo.");
            TrackingType type = product.getTrackingType() != null ? product.getTrackingType() : TrackingType.CONSUMABLE;
            if (type != TrackingType.REUSABLE && type != TrackingType.ASSET) {
                throw new IllegalArgumentException("Solo herramientas reutilizables y activos se procesan como préstamo.");
            }
            LoanLine line = LoanLine.builder().loan(loan).product(product).quantity(item.quantity())
                    .returnedQuantity(BigDecimal.ZERO).conditionOut(item.conditionOut()).build();
            loan.getLines().add(line);

            if (type == TrackingType.REUSABLE) {
                if (item.assetIds() != null && !item.assetIds().isEmpty()) {
                    throw new IllegalArgumentException("No selecciones unidades individuales para herramientas de stock compartido.");
                }
                if (product.getStock().compareTo(item.quantity()) < 0) {
                    throw new IllegalArgumentException("Stock insuficiente para prestar " + product.getName() + ".");
                }
                product.setStock(product.getStock().subtract(item.quantity()));
                productRepository.save(product);
                saveMovement(product, issuer, borrower, area, loan, null, MovementType.SALIDA,
                        item.quantity(), MovementPurpose.LOAN_ISSUE, loan.getPurpose(), null, item.conditionOut(), null);
            } else {
                List<Long> ids = item.assetIds() != null ? item.assetIds() : List.of();
                if (item.quantity().stripTrailingZeros().scale() > 0
                        || item.quantity().compareTo(BigDecimal.valueOf(ids.size())) != 0) {
                    throw new IllegalArgumentException("Para activos serializados selecciona exactamente una unidad por cada activo prestado.");
                }
                if (new HashSet<>(ids).size() != ids.size() || ids.stream().anyMatch(processedAssetIds::contains)) {
                    throw new IllegalArgumentException("Una misma unidad de activo no puede aparecer dos veces en el préstamo.");
                }
                for (Long assetId : ids) {
                    processedAssetIds.add(assetId);
                    InventoryAsset asset = assetRepository.findByIdForUpdate(assetId)
                            .orElseThrow(() -> new EntityNotFoundException("Activo no encontrado: " + assetId));
                    if (!asset.getProduct().getId().equals(product.getId()) || asset.getStatus() == AssetStatus.ON_LOAN
                            || asset.getStatus() == AssetStatus.RETIRED) {
                        throw new IllegalArgumentException("El activo " + asset.getAssetCode() + " no está disponible para préstamo.");
                    }
                    ItemCondition conditionOut = asset.getCondition();
                    asset.setStatus(AssetStatus.ON_LOAN);
                    asset.setArea(area);
                    asset.setResponsible(borrower);
                    assetRepository.save(asset);
                    line.getAssets().add(LoanAsset.builder().loanLine(line).asset(asset)
                            .conditionOut(conditionOut).build());
                    saveMovement(product, issuer, borrower, area, loan, asset, MovementType.SALIDA,
                            BigDecimal.ONE, MovementPurpose.LOAN_ISSUE, loan.getPurpose(), null, conditionOut, null);
                }
            }
        }
        return toLoanResponse(loanRepository.save(loan));
    }

    @Transactional
    public LoanResponse returnLoan(Long id, LoanReturnRequest request) {
        loanRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new EntityNotFoundException("Préstamo no encontrado: " + id));
        Loan loan = loanRepository.findWithDetailsById(id)
                .orElseThrow(() -> new EntityNotFoundException("Préstamo no encontrado: " + id));
        if (loan.getStatus() == LoanStatus.CLOSED) throw new IllegalStateException("El préstamo ya está cerrado.");
        User receivedBy = currentActor(request.receivedById());
        User returnedBy = findExistingUser(request.returnedById());
        StorageArea area = findArea(request.areaId());

        for (LoanReturnItemRequest item : request.items()) {
            LoanLine line = loan.getLines().stream().filter(candidate -> candidate.getId().equals(item.loanLineId()))
                    .findFirst().orElseThrow(() -> new IllegalArgumentException("La línea no pertenece a este préstamo."));
            TrackingType type = line.getProduct().getTrackingType() != null
                    ? line.getProduct().getTrackingType() : TrackingType.CONSUMABLE;
            if (type == TrackingType.ASSET) {
                List<Long> ids = item.assetIds() != null ? item.assetIds() : List.of();
                if (ids.isEmpty() || item.quantity() == null || item.quantity().stripTrailingZeros().scale() > 0
                        || item.quantity().compareTo(BigDecimal.valueOf(ids.size())) != 0) {
                    throw new IllegalArgumentException("Selecciona los activos serializados que efectivamente regresaron.");
                }
                for (Long assetId : ids) {
                    LoanAsset loanAsset = line.getAssets().stream()
                            .filter(candidate -> candidate.getAsset().getId().equals(assetId))
                            .findFirst().orElseThrow(() -> new IllegalArgumentException("El activo no pertenece a esta línea del préstamo."));
                    if (loanAsset.getReturnedAt() != null) throw new IllegalArgumentException("El activo ya fue devuelto.");
                    InventoryAsset asset = loanAsset.getAsset();
                    loanAsset.setConditionIn(item.condition());
                    loanAsset.setReturnedAt(LocalDate.now());
                    asset.setCondition(item.condition());
                    asset.setStatus(item.condition() == ItemCondition.OUT_OF_SERVICE ? AssetStatus.RETIRED : AssetStatus.IN_STOCK);
                    asset.setArea(area);
                    asset.setResponsible(null);
                    assetRepository.save(asset);
                    line.setReturnedQuantity(line.getReturnedQuantity().add(BigDecimal.ONE));
                    saveMovement(line.getProduct(), receivedBy, returnedBy, area, loan, asset, MovementType.ENTRADA,
                            BigDecimal.ONE, MovementPurpose.LOAN_RETURN, "Devolución de " + loan.getLoanNumber(),
                            loanAsset.getConditionOut(), item.condition(), null);
                }
            } else if (type == TrackingType.REUSABLE) {
                BigDecimal quantity = item.quantity();
                if (quantity == null || quantity.signum() <= 0
                        || line.getReturnedQuantity().add(quantity).compareTo(line.getQuantity()) > 0) {
                    throw new IllegalArgumentException("La cantidad devuelta debe ser mayor que cero y no superar lo pendiente.");
                }
                Product product = productRepository.findByIdForUpdate(line.getProduct().getId())
                        .orElseThrow(() -> new EntityNotFoundException("Producto no encontrado."));
                product.setStock(product.getStock().add(quantity));
                productRepository.save(product);
                line.setReturnedQuantity(line.getReturnedQuantity().add(quantity));
                saveMovement(product, receivedBy, returnedBy, area, loan, null, MovementType.ENTRADA,
                        quantity, MovementPurpose.LOAN_RETURN, "Devolución de " + loan.getLoanNumber(),
                        line.getConditionOut(), item.condition(), null);
            } else {
                throw new IllegalArgumentException("Esta línea no pertenece a un artículo reutilizable.");
            }
            loanLineRepository.save(line);
        }

        boolean hasPending = loan.getLines().stream().anyMatch(line -> line.getReturnedQuantity().compareTo(line.getQuantity()) < 0);
        loan.setStatus(hasPending ? LoanStatus.PARTIALLY_RETURNED : LoanStatus.CLOSED);
        if (!hasPending) loan.setClosedAt(LocalDate.now());
        return toLoanResponse(loanRepository.save(loan));
    }

    private void saveAssetMovement(InventoryAsset asset, User actor, User recipient, StorageArea area,
            MovementPurpose purpose, MovementType type, ItemCondition before, ItemCondition after, String reason) {
        saveMovement(asset.getProduct(), actor, recipient, area, null, asset, type, BigDecimal.ONE,
                purpose, reason, before, after, null);
    }

    private void saveMovement(Product product, User actor, User recipient, StorageArea area, Loan loan,
            InventoryAsset asset, MovementType type, BigDecimal quantity, MovementPurpose purpose,
            String reason, ItemCondition before, ItemCondition after, String vehicleEquipment) {
        Movement movement = movementRepository.save(Movement.builder().product(product).user(actor).receivedBy(recipient)
                .area(area).loan(loan).asset(asset).type(type).quantity(quantity).purpose(purpose)
                .reason(reason).conditionBefore(before).conditionAfter(after).vehicleEquipment(vehicleEquipment)
                .movementDate(LocalDate.now()).build());
        inventoryService.recordStockLedger(movement);
    }

    private User findUser(Long id) {
        return userRepository.findById(id).filter(User::getEnabled)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado o desactivado: " + id));
    }

    private User findExistingUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Usuario no encontrado: " + id));
    }

    private User currentActor(Long fallbackUserId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal) {
            return findUser(principal.id());
        }
        return findUser(fallbackUserId);
    }

    private StorageArea findArea(Long id) {
        if (id == null) throw new IllegalArgumentException("Selecciona el área o ubicación.");
        return areaRepository.findById(id).filter(StorageArea::getActive)
                .orElseThrow(() -> new EntityNotFoundException("Área no encontrada: " + id));
    }

    private AreaResponse toAreaResponse(StorageArea area) {
        return new AreaResponse(area.getId(), area.getName(), area.getDescription());
    }

    private AssetResponse toAssetResponse(InventoryAsset asset) {
        return new AssetResponse(asset.getId(), asset.getQrToken(), asset.getAssetCode(), asset.getSerialNumber(),
                asset.getProduct().getId(), asset.getProduct().getName(), asset.getProduct().getCode(),
                asset.getArea() != null ? asset.getArea().getId() : null,
                asset.getArea() != null ? asset.getArea().getName() : null,
                asset.getResponsible() != null ? asset.getResponsible().getId() : null,
                asset.getResponsible() != null ? asset.getResponsible().getFullName() : null,
                asset.getCondition(), asset.getStatus());
    }

    private LoanResponse toLoanResponse(Loan loan) {
        List<LoanLineResponse> lines = loan.getLines().stream().map(line -> {
            List<AssetResponse> assets = line.getAssets().stream().map(LoanAsset::getAsset)
                    .map(this::toAssetResponse).toList();
            BigDecimal outstanding = line.getQuantity().subtract(line.getReturnedQuantity());
            return new LoanLineResponse(line.getId(), line.getProduct().getId(), line.getProduct().getName(),
                    line.getProduct().getCode(), line.getQuantity(), line.getReturnedQuantity(), outstanding,
                    line.getConditionOut(), assets);
        }).toList();
        return new LoanResponse(loan.getId(), loan.getLoanNumber(), loan.getBorrower().getId(),
                loan.getBorrower().getFullName(), loan.getIssuedBy().getId(), loan.getIssuedBy().getFullName(),
                loan.getArea().getId(), loan.getArea().getName(), loan.getPurpose(), loan.getIssuedAt(),
                loan.getDueAt(), loan.getClosedAt(), loan.getStatus(), lines);
    }
}
