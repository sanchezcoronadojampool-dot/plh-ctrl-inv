package com.plh.condominio.controller;

import com.plh.condominio.dto.InventorySummaryDto;
import com.plh.condominio.dto.AreaRequest;
import com.plh.condominio.dto.AreaResponse;
import com.plh.condominio.dto.AssetAssignRequest;
import com.plh.condominio.dto.AssetRequest;
import com.plh.condominio.dto.AssetResponse;
import com.plh.condominio.dto.LoanRequest;
import com.plh.condominio.dto.LoanResponse;
import com.plh.condominio.dto.LoanReturnRequest;
import com.plh.condominio.dto.MovementRequest;
import com.plh.condominio.dto.MovementResponse;
import com.plh.condominio.dto.ProductRequest;
import com.plh.condominio.dto.ProductResponse;
import com.plh.condominio.dto.QrAssetDetailResponse;
import com.plh.condominio.dto.UserRequest;
import com.plh.condominio.dto.UserResponse;
import com.plh.condominio.dto.InventoryPersonResponse;
import com.plh.condominio.dto.StockLedgerEntryResponse;
import com.plh.condominio.dto.StockReconciliationResponse;
import com.plh.condominio.service.InventoryService;
import com.plh.condominio.service.InventoryOperationsService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryOperationsService operationsService;

    public InventoryController(InventoryService inventoryService, InventoryOperationsService operationsService) {
        this.inventoryService = inventoryService;
        this.operationsService = operationsService;
    }

    @GetMapping("/dashboard")
    public InventorySummaryDto getDashboard() {
        return inventoryService.getSummary();
    }

    @GetMapping("/products")
    public List<ProductResponse> getProducts() {
        return inventoryService.getProducts();
    }

    @PostMapping("/products")
    public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createProduct(request));
    }

    @PutMapping("/products/{id}")
    public ProductResponse updateProduct(@PathVariable Long id, @Valid @RequestBody ProductRequest request) {
        return inventoryService.updateProduct(id, request);
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        inventoryService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    public List<UserResponse> getUsers() {
        return inventoryService.getUsers();
    }

    @GetMapping("/people")
    public List<InventoryPersonResponse> getPeople() {
        return inventoryService.getPeople();
    }

    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createUser(request));
    }

    @PutMapping("/users/{id}")
    public UserResponse updateUser(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
        return inventoryService.updateUser(id, request);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        inventoryService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/movements")
    public List<MovementResponse> getMovements() {
        return inventoryService.getMovements();
    }

    @GetMapping("/products/{id}/ledger")
    public List<StockLedgerEntryResponse> getStockLedger(@PathVariable Long id) {
        return inventoryService.getStockLedger(id);
    }

    @GetMapping("/ledger/reconciliation")
    public List<StockReconciliationResponse> reconcileStockLedger() {
        return inventoryService.reconcileStockLedger();
    }

    @PostMapping("/movements")
    public ResponseEntity<MovementResponse> createMovement(@Valid @RequestBody MovementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createMovement(request));
    }

    @GetMapping("/areas")
    public List<AreaResponse> getAreas() {
        return operationsService.getAreas();
    }

    @PostMapping("/areas")
    public ResponseEntity<AreaResponse> createArea(@Valid @RequestBody AreaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.createArea(request));
    }

    @GetMapping("/assets")
    public List<AssetResponse> getAssets() {
        return operationsService.getAssets();
    }

    @PostMapping("/assets")
    public ResponseEntity<AssetResponse> registerAsset(@Valid @RequestBody AssetRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.registerAsset(request));
    }

    @PutMapping("/assets/{id}/assign")
    public AssetResponse assignAsset(@PathVariable Long id, @Valid @RequestBody AssetAssignRequest request) {
        return operationsService.assignAsset(id, request);
    }

    @GetMapping("/qr/{token}")
    public QrAssetDetailResponse getAssetByQr(@PathVariable String token) {
        return operationsService.getAssetByQr(token);
    }

    @GetMapping("/loans")
    public List<LoanResponse> getLoans() {
        return operationsService.getLoans();
    }

    @PostMapping("/loans")
    public ResponseEntity<LoanResponse> issueLoan(@Valid @RequestBody LoanRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.issueLoan(request));
    }

    @PostMapping("/loans/{id}/returns")
    public LoanResponse returnLoan(@PathVariable Long id, @Valid @RequestBody LoanReturnRequest request) {
        return operationsService.returnLoan(id, request);
    }
}
