package com.plh.condominio.service;

import com.plh.condominio.dto.InventorySummaryDto;
import com.plh.condominio.dto.MovementRequest;
import com.plh.condominio.dto.MovementResponse;
import com.plh.condominio.dto.ProductRequest;
import com.plh.condominio.dto.ProductResponse;
import com.plh.condominio.dto.UserRequest;
import com.plh.condominio.dto.UserResponse;
import com.plh.condominio.dto.InventoryPersonResponse;
import com.plh.condominio.dto.StockLedgerEntryResponse;
import com.plh.condominio.dto.StockReconciliationResponse;
import com.plh.condominio.entity.Movement;
import com.plh.condominio.entity.MovementType;
import com.plh.condominio.entity.MovementPurpose;
import com.plh.condominio.entity.AccessRole;
import com.plh.condominio.entity.TrackingType;
import com.plh.condominio.entity.StorageArea;
import com.plh.condominio.entity.AssetStatus;
import com.plh.condominio.entity.Product;
import com.plh.condominio.entity.User;
import com.plh.condominio.entity.InventoryStockLedgerEntry;
import com.plh.condominio.security.AuthenticatedUser;
import com.plh.condominio.repository.MovementRepository;
import com.plh.condominio.repository.InventoryStockLedgerRepository;
import com.plh.condominio.repository.LoanLineRepository;
import com.plh.condominio.repository.ProductRepository;
import com.plh.condominio.repository.UserRepository;
import com.plh.condominio.repository.AreaRepository;
import com.plh.condominio.repository.AssetRepository;
import jakarta.persistence.EntityNotFoundException;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
public class InventoryService {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final MovementRepository movementRepository;
    private final AreaRepository areaRepository;
    private final AssetRepository assetRepository;
    private final PasswordEncoder passwordEncoder;
    private final InventoryStockLedgerRepository stockLedgerRepository;
    private final LoanLineRepository loanLineRepository;

    public InventoryService(ProductRepository productRepository, UserRepository userRepository, MovementRepository movementRepository,
            AreaRepository areaRepository, AssetRepository assetRepository, PasswordEncoder passwordEncoder,
            InventoryStockLedgerRepository stockLedgerRepository, LoanLineRepository loanLineRepository) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.movementRepository = movementRepository;
        this.areaRepository = areaRepository;
        this.assetRepository = assetRepository;
        this.passwordEncoder = passwordEncoder;
        this.stockLedgerRepository = stockLedgerRepository;
        this.loanLineRepository = loanLineRepository;
    }

    private static void validatePassword(String password) {
        int byteLength = password.getBytes(StandardCharsets.UTF_8).length;
        if (password.length() < 12 || byteLength > 72) {
            throw new IllegalArgumentException("La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8.");
        }
    }

    private User currentActor(Long fallbackUserId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal) {
            return userRepository.findById(principal.id())
                    .orElseThrow(() -> new EntityNotFoundException("La cuenta autenticada ya no existe."));
        }
        return userRepository.findById(fallbackUserId)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + fallbackUserId));
    }
    @Transactional(readOnly = true)
    public List<ProductResponse> getProducts() {
        return productRepository.findAll().stream()
                .filter(Product::getActive)
                .map(this::toProductResponse)
                .toList();
    }

    private static void validateTrackingUnit(TrackingType trackingType, String unit) {
        if (trackingType == TrackingType.FUEL && !isGallonUnit(unit)) {
            throw new IllegalArgumentException("El combustible debe medirse en galones.");
        }
    }

    private static boolean isGallonUnit(String unit) {
        return unit != null && List.of("galón", "galones", "gal", "gallon", "gallons")
                .contains(unit.trim().toLowerCase(java.util.Locale.ROOT));
    }

    @Transactional
    public ProductResponse createProduct(ProductRequest request) {
        TrackingType trackingType = request.trackingType() != null ? request.trackingType() : TrackingType.CONSUMABLE;
        BigDecimal stock = request.stock();
        if (stock.signum() != 0) {
            throw new IllegalArgumentException("Registra la existencia inicial mediante un movimiento de entrada para mantener el historial conciliable.");
        }
        if (trackingType == TrackingType.ASSET && stock.stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("La existencia de activos unitarios debe ser un número entero.");
        }
        validateTrackingUnit(trackingType, request.unit());
        Product product = Product.builder()
                .code(request.code())
                .name(request.name())
                .category(request.category())
                .stock(stock)
                .minimumStock(request.minimumStock())
                .location(request.location())
                .unit(request.unit())
                .trackingType(trackingType)
                .active(true)
                .build();

        return toProductResponse(productRepository.save(product));
    }

    @Transactional
    public ProductResponse updateProduct(Long id, ProductRequest request) {
        Product product = productRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + id));

        product.setCode(request.code());
        product.setName(request.name());
        product.setCategory(request.category());
        if (request.stock().compareTo(product.getStock()) != 0) {
            throw new IllegalArgumentException("El stock solo cambia mediante compras, consumos, préstamos, devoluciones o ajustes.");
        }
        product.setMinimumStock(request.minimumStock());
        product.setLocation(request.location());
        product.setUnit(request.unit());
        if (request.trackingType() != null && request.trackingType() != product.getTrackingType()) {
            if (assetRepository.countByProduct_Id(product.getId()) > 0
                    || loanLineRepository.existsByProduct_Id(product.getId())
                    || movementRepository.existsByProduct_Id(product.getId())) {
                throw new IllegalArgumentException("No se puede cambiar el seguimiento de un producto que ya tiene activos o movimientos de inventario.");
            }
            if (request.trackingType() == TrackingType.ASSET && product.getStock().stripTrailingZeros().scale() > 0) {
                throw new IllegalArgumentException("La existencia debe ser entera para convertir el producto en activo serializado.");
            }
            if (request.trackingType() == TrackingType.FUEL && !isGallonUnit(request.unit())) {
                throw new IllegalArgumentException("El combustible debe medirse en galones.");
            }
            product.setTrackingType(request.trackingType());
        }
        validateTrackingUnit(request.trackingType() != null ? request.trackingType() : product.getTrackingType(), request.unit());

        return toProductResponse(productRepository.save(product));
    }

    public void deleteProduct(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + id));
        product.setActive(false);
        productRepository.save(product);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers() {
        return userRepository.findAll().stream().map(this::toUserResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<InventoryPersonResponse> getPeople() {
        return userRepository.findAllByEnabledTrueOrderByFullNameAsc().stream()
                .map(user -> new InventoryPersonResponse(user.getId(), user.getFullName(), user.getJobTitle()))
                .toList();
    }

    @Transactional
    public UserResponse createUser(UserRequest request) {
        if (request.password() == null || request.password().isBlank()) {
            throw new IllegalArgumentException("Establece una contraseña temporal de al menos 12 caracteres.");
        }
        validatePassword(request.password());
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new IllegalArgumentException("Ya existe una cuenta con ese correo electrónico.");
        }
        User user = User.builder()
                .fullName(request.fullName().trim())
                .jobTitle(request.jobTitle().trim())
                .role(request.role())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .build();

        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateUser(Long id, UserRequest request) {
        List<User> activeAdmins = userRepository.findActiveByRoleForUpdate(AccessRole.ADMIN);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + id));
        ensureHasActiveAdmin(user, request.role(), activeAdmins.size());
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        userRepository.findByEmailIgnoreCase(email).filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new IllegalArgumentException("Ya existe una cuenta con ese correo electrónico."); });
        user.setFullName(request.fullName().trim());
        user.setJobTitle(request.jobTitle().trim());
        user.setRole(request.role());
        user.setEmail(email);
        if (!user.getEnabled() && (request.password() == null || request.password().isBlank())) {
            throw new IllegalArgumentException("Establece una nueva contraseña temporal para reactivar esta cuenta.");
        }
        user.setEnabled(true);
        if (request.password() != null && !request.password().isBlank()) {
            validatePassword(request.password());
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        return toUserResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) {
        List<User> activeAdmins = userRepository.findActiveByRoleForUpdate(AccessRole.ADMIN);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found: " + id));
        if (user.getRole() == AccessRole.ADMIN
                && activeAdmins.size() <= 1) {
            throw new IllegalStateException("No se puede desactivar la última cuenta administradora activa.");
        }
        if (SecurityContextHolder.getContext().getAuthentication().getName().equalsIgnoreCase(user.getEmail())) {
            throw new IllegalStateException("No puedes desactivar tu propia cuenta.");
        }
        user.setEnabled(false);
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<MovementResponse> getMovements() {
        return movementRepository.findAllByOrderByMovementDateDescCreatedAtDesc().stream().map(this::toMovementResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<StockLedgerEntryResponse> getStockLedger(Long productId) {
        if (!productRepository.existsById(productId)) {
            throw new EntityNotFoundException("Product not found: " + productId);
        }
        return stockLedgerRepository.findAllByProduct_IdOrderByCreatedAtDescIdDesc(productId).stream()
                .map(entry -> new StockLedgerEntryResponse(entry.getId(), entry.getProduct().getId(),
                        entry.getProduct().getName(), entry.getMovement() != null ? entry.getMovement().getId() : null,
                        entry.getActor() != null ? entry.getActor().getFullName() : null, entry.getEventType(),
                        entry.getQuantityDelta(), entry.getBalanceAfter(), entry.getReason(), entry.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StockReconciliationResponse> reconcileStockLedger() {
        Map<Long, BigDecimal> ledgerBalances = new java.util.HashMap<>();
        stockLedgerRepository.getBalancesByProduct().forEach(row ->
                ledgerBalances.put((Long) row[0], (BigDecimal) row[1]));
        return productRepository.findAll().stream().filter(Product::getActive)
                .map(product -> {
                    BigDecimal ledgerBalance = ledgerBalances.getOrDefault(product.getId(), BigDecimal.ZERO);
                    return new StockReconciliationResponse(product.getId(), product.getCode(), product.getName(),
                            ledgerBalance, product.getStock(), product.getStock().subtract(ledgerBalance));
                })
                .filter(result -> result.difference().signum() != 0)
                .toList();
    }

    @Transactional
    public MovementResponse createMovement(MovementRequest request) {
        Product product = productRepository.findByIdForUpdate(request.productId())
                .orElseThrow(() -> new EntityNotFoundException("Product not found: " + request.productId()));
        if (!product.getActive()) {
            throw new IllegalArgumentException("El producto está inactivo y no admite movimientos.");
        }
        User user = currentActor(request.userId());

        TrackingType trackingType = effectiveType(product);
        if (request.type() == MovementType.SALIDA
                && (trackingType == TrackingType.ASSET || trackingType == TrackingType.REUSABLE)) {
            throw new IllegalArgumentException("Los activos y artículos reutilizables se entregan mediante un préstamo o asignación.");
        }
        if (trackingType == TrackingType.ASSET && request.quantity().stripTrailingZeros().scale() > 0) {
            throw new IllegalArgumentException("La compra de activos serializados debe registrarse en unidades enteras.");
        }
        if (request.type() == MovementType.SALIDA && product.getStock().compareTo(request.quantity()) < 0) {
            throw new IllegalArgumentException("Insufficient stock for product: " + product.getName());
        }

        User recipient = request.recipientId() != null
                ? userRepository.findById(request.recipientId()).filter(User::getEnabled)
                        .orElseThrow(() -> new EntityNotFoundException("Recipient not found: " + request.recipientId()))
                : null;
        StorageArea area = request.areaId() != null
                ? areaRepository.findById(request.areaId())
                        .orElseThrow(() -> new EntityNotFoundException("Area not found: " + request.areaId()))
                : null;
        MovementPurpose purpose = request.purpose() != null ? request.purpose()
                : request.type() == MovementType.ENTRADA ? MovementPurpose.PURCHASE
                : trackingType == TrackingType.FUEL ? MovementPurpose.FUEL_USE : MovementPurpose.CONSUMPTION;
        if (purpose == MovementPurpose.ADJUSTMENT) {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            boolean administrator = authentication != null && authentication.getAuthorities().stream()
                    .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
            if (!administrator) throw new IllegalStateException("Solo un administrador puede registrar ajustes de inventario.");
            if (request.reason() == null || request.reason().isBlank()) {
                throw new IllegalArgumentException("Explica el motivo del ajuste de inventario.");
            }
        } else if (request.type() == MovementType.ENTRADA && purpose != MovementPurpose.PURCHASE) {
            throw new IllegalArgumentException("Una entrada debe registrarse como compra o ajuste.");
        }
        if (request.type() == MovementType.SALIDA && recipient == null) {
            throw new IllegalArgumentException("Indica a quién se entrega la salida del almacén.");
        }
        if (request.type() == MovementType.SALIDA && trackingType == TrackingType.FUEL
                && (purpose != MovementPurpose.FUEL_USE || request.vehicleEquipment() == null || request.vehicleEquipment().isBlank())) {
            throw new IllegalArgumentException("Para combustible registra el uso y el vehículo o equipo abastecido.");
        }
        if (request.type() == MovementType.SALIDA && trackingType == TrackingType.FUEL
                && (request.reason() == null || request.reason().isBlank())) {
            throw new IllegalArgumentException("Describe para qué se utilizará el combustible.");
        }
        if (request.type() == MovementType.SALIDA && trackingType == TrackingType.CONSUMABLE
                && purpose != MovementPurpose.CONSUMPTION) {
            throw new IllegalArgumentException("La salida de consumibles debe registrarse como consumo/entrega.");
        }

        BigDecimal updatedStock = request.type() == MovementType.ENTRADA
                ? product.getStock().add(request.quantity())
                : product.getStock().subtract(request.quantity());
        product.setStock(updatedStock);
        productRepository.save(product);

        Movement movement = Movement.builder()
                .product(product)
                .user(user)
                .receivedBy(recipient)
                .area(area)
                .type(request.type())
                .quantity(request.quantity())
                .purpose(purpose)
                .reason(request.reason())
                .vehicleEquipment(request.vehicleEquipment())
                .conditionBefore(request.condition())
                .conditionAfter(request.condition())
                .movementDate(request.movementDate() != null ? request.movementDate() : LocalDate.now())
                .build();

        movement = movementRepository.save(movement);
        recordStockLedger(movement);
        return toMovementResponse(movement);
    }

    @Transactional
    public void recordStockLedger(Movement movement) {
        if (movement.getPurpose() == MovementPurpose.ASSET_ASSIGNMENT) return;
        if (effectiveType(movement.getProduct()) == TrackingType.ASSET
                && movement.getPurpose() != MovementPurpose.PURCHASE
                && movement.getPurpose() != MovementPurpose.ADJUSTMENT) return;
        BigDecimal delta = movement.getType() == MovementType.ENTRADA
                ? movement.getQuantity() : movement.getQuantity().negate();
        InventoryStockLedgerEntry entry = new InventoryStockLedgerEntry();
        entry.setProduct(movement.getProduct());
        entry.setMovement(movement);
        entry.setActor(movement.getUser());
        entry.setEventType(movement.getPurpose().name());
        entry.setQuantityDelta(delta);
        entry.setBalanceAfter(movement.getProduct().getStock());
        entry.setReason(movement.getReason() != null && !movement.getReason().isBlank()
                ? movement.getReason() : movement.getPurpose().name());
        stockLedgerRepository.save(entry);
    }

    @Transactional
    public void recordOpeningBalance(Product product, String reason) {
        if (stockLedgerRepository.existsByProduct_Id(product.getId())) return;
        InventoryStockLedgerEntry entry = new InventoryStockLedgerEntry();
        entry.setProduct(product);
        entry.setEventType("OPENING_BALANCE");
        entry.setQuantityDelta(product.getStock());
        entry.setBalanceAfter(product.getStock());
        entry.setReason(reason);
        stockLedgerRepository.save(entry);
    }

    public InventorySummaryDto getSummary() {
        List<Product> products = productRepository.findAll().stream().filter(Product::getActive).toList();
        long totalProducts = products.size();
        Map<String, BigDecimal> stocksByUnit = new TreeMap<>();
        products.forEach(product -> stocksByUnit.merge(
                product.getUnit() != null && !product.getUnit().isBlank() ? product.getUnit() : "sin unidad",
                product.getStock(), BigDecimal::add));
        long lowStockCount = products.stream().filter(p -> p.getStock().compareTo(p.getMinimumStock()) <= 0).count();
        long movementsToday = movementRepository.countByMovementDate(LocalDate.now());

        return new InventorySummaryDto(totalProducts, stocksByUnit, lowStockCount, movementsToday);
    }

    private ProductResponse toProductResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getCode(),
                product.getName(),
                product.getCategory(),
                product.getStock(),
                product.getMinimumStock(),
                product.getLocation(),
                product.getUnit(),
                product.getActive(),
                effectiveType(product),
                effectiveType(product) == TrackingType.ASSET
                        ? BigDecimal.valueOf(assetRepository.countByProduct_IdAndStatusIn(product.getId(),
                                List.of(AssetStatus.IN_STOCK, AssetStatus.ASSIGNED)))
                        : product.getStock()
        );
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getJobTitle(), user.getRole(), user.getEmail(), user.getEnabled());
    }

    private void ensureHasActiveAdmin(User current, AccessRole updatedRole, int activeAdminCount) {
        if (current.getEnabled() && current.getRole() == AccessRole.ADMIN && updatedRole != AccessRole.ADMIN
                && activeAdminCount <= 1) {
            throw new IllegalStateException("No se puede cambiar el rol del último administrador activo.");
        }
    }

    MovementResponse toMovementResponse(Movement movement) {
        return new MovementResponse(
                movement.getId(),
                movement.getProduct().getId(),
                movement.getProduct().getName(),
                movement.getUser().getId(),
                movement.getUser().getFullName(),
                movement.getReceivedBy() != null ? movement.getReceivedBy().getId() : null,
                movement.getReceivedBy() != null ? movement.getReceivedBy().getFullName() : null,
                movement.getArea() != null ? movement.getArea().getId() : null,
                movement.getArea() != null ? movement.getArea().getName() : null,
                movement.getAsset() != null ? movement.getAsset().getId() : null,
                movement.getAsset() != null ? movement.getAsset().getAssetCode() : null,
                movement.getLoan() != null ? movement.getLoan().getLoanNumber() : null,
                movement.getType(),
                movement.getQuantity(),
                movement.getPurpose() != null ? movement.getPurpose() : MovementPurpose.LEGACY,
                movement.getReason(),
                movement.getVehicleEquipment(),
                movement.getConditionBefore() != null ? movement.getConditionBefore().name() : null,
                movement.getConditionAfter() != null ? movement.getConditionAfter().name() : null,
                movement.getMovementDate(),
                movement.getCreatedAt()
        );
    }

    private TrackingType effectiveType(Product product) {
        return product.getTrackingType() != null ? product.getTrackingType() : TrackingType.CONSUMABLE;
    }
}
