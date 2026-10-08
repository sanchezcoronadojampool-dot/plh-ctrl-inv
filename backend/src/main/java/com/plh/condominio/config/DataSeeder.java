package com.plh.condominio.config;

import com.plh.condominio.entity.AssetStatus;
import com.plh.condominio.entity.AccessRole;
import com.plh.condominio.entity.InventoryAsset;
import com.plh.condominio.entity.ItemCondition;
import com.plh.condominio.entity.Movement;
import com.plh.condominio.entity.MovementPurpose;
import com.plh.condominio.entity.MovementType;
import com.plh.condominio.entity.Product;
import com.plh.condominio.entity.StorageArea;
import com.plh.condominio.entity.TrackingType;
import com.plh.condominio.entity.User;
import com.plh.condominio.repository.AreaRepository;
import com.plh.condominio.repository.AssetRepository;
import com.plh.condominio.repository.MovementRepository;
import com.plh.condominio.repository.ProductRepository;
import com.plh.condominio.repository.UserRepository;
import com.plh.condominio.service.InventoryService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Component
@Profile("demo")
public class DataSeeder implements CommandLineRunner {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final MovementRepository movementRepository;
    private final AreaRepository areaRepository;
    private final AssetRepository assetRepository;
    private final PasswordEncoder passwordEncoder;
    private final InventoryService inventoryService;

    public DataSeeder(ProductRepository productRepository, UserRepository userRepository,
            MovementRepository movementRepository, AreaRepository areaRepository, AssetRepository assetRepository,
            PasswordEncoder passwordEncoder, InventoryService inventoryService) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.movementRepository = movementRepository;
        this.areaRepository = areaRepository;
        this.assetRepository = assetRepository;
        this.passwordEncoder = passwordEncoder;
        this.inventoryService = inventoryService;
    }

    @Override
    public void run(String... args) {
        seedUsers();
        seedAreas();
        seedInitialProducts();
        normalizeLegacyProductTypes();
        ensureProduct("P-2001", "Televisor", "Activos", BigDecimal.valueOf(4), BigDecimal.ZERO,
                "Varias áreas", "unidad", TrackingType.ASSET);
        ensureProduct("P-2002", "Radio walkie-talkie", "Seguridad", BigDecimal.valueOf(3), BigDecimal.ZERO,
                "Cámaras", "unidad", TrackingType.ASSET);
        ensureProduct("P-3001", "Papel higiénico", "Limpieza", BigDecimal.valueOf(36), BigDecimal.valueOf(8),
                "Almacén", "rollo", TrackingType.CONSUMABLE);
        ensureProduct("P-4001", "Gasolina", "Combustible", new BigDecimal("50.000"), new BigDecimal("10.000"),
                "Almacén de combustible", "galón", TrackingType.FUEL);
        seedTelevisionAssets();
        productRepository.findAll().forEach(product ->
                inventoryService.recordOpeningBalance(product, "Saldo inicial de datos de demostración"));
    }

    private void seedUsers() {
        if (userRepository.count() != 0) return;
        userRepository.save(User.builder().fullName("María García").role(AccessRole.ADMIN)
                .jobTitle("Administradora").email("maria@condominio.com")
                .passwordHash(passwordEncoder.encode("DemoPassword123!")).build());
        userRepository.save(User.builder().fullName("Pedro López").role(AccessRole.INVENTORY_MANAGER)
                .jobTitle("Encargado de almacén").email("pedro@condominio.com")
                .passwordHash(passwordEncoder.encode("DemoPassword123!")).build());
        userRepository.save(User.builder().fullName("Ana Torres").role(AccessRole.VIEWER)
                .jobTitle("Residente").email("ana@condominio.com")
                .passwordHash(passwordEncoder.encode("DemoPassword123!")).build());
    }

    private void seedAreas() {
        List<String> names = List.of("Almacén", "Cámaras", "Administración", "Baños", "Jardinería", "Mantenimiento", "Vehículos");
        List<String> existing = areaRepository.findAllByActiveTrueOrderByNameAsc().stream().map(StorageArea::getName).toList();
        for (String name : names) {
            if (!existing.contains(name)) areaRepository.save(StorageArea.builder().name(name).active(true).build());
        }
    }

    private void seedInitialProducts() {
        if (productRepository.count() != 0) return;
        Product martillo = saveProduct("P-1001", "Martillo", "Herramientas", 12, 5,
                "Almacén", "pza", TrackingType.CONSUMABLE);
        Product taladro = saveProduct("P-1002", "Taladro percutor", "Herramientas", 4, 3,
                "Almacén", "pza", TrackingType.REUSABLE);
        Product desinfectante = saveProduct("P-1005", "Desinfectante", "Limpieza", 22, 8,
                "Almacén", "botella", TrackingType.CONSUMABLE);

        User admin = findSeedUser("Administrador");
        User manager = findSeedUser("Encargado");
        saveSeedMovement(martillo, manager, MovementType.ENTRADA, 5, MovementPurpose.PURCHASE,
                "Compra mensual", LocalDate.now().minusDays(2));
        saveSeedMovement(taladro, admin, MovementType.SALIDA, 2, MovementPurpose.LEGACY,
                "Mantenimiento de áreas comunes", LocalDate.now().minusDays(1));
        saveSeedMovement(desinfectante, manager, MovementType.ENTRADA, 10, MovementPurpose.PURCHASE,
                "Reposición", LocalDate.now());
    }

    private void normalizeLegacyProductTypes() {
        for (Product product : productRepository.findAll()) {
            if (product.getTrackingType() == null) {
                product.setTrackingType(product.getCode().equals("P-1002")
                        ? TrackingType.REUSABLE : TrackingType.CONSUMABLE);
                productRepository.save(product);
            }
        }
    }

    private Product saveProduct(String code, String name, String category, int stock, int minimumStock,
            String location, String unit, TrackingType trackingType) {
        return productRepository.save(Product.builder().code(code).name(name).category(category)
                .stock(BigDecimal.valueOf(stock)).minimumStock(BigDecimal.valueOf(minimumStock))
                .location(location).unit(unit).trackingType(trackingType).active(true).build());
    }

    private void ensureProduct(String code, String name, String category, BigDecimal stock, BigDecimal minimumStock,
            String location, String unit, TrackingType type) {
        productRepository.findByCode(code).orElseGet(() -> productRepository.save(Product.builder()
                .code(code).name(name).category(category).stock(stock).minimumStock(minimumStock)
                .location(location).unit(unit).trackingType(type).active(true).build()));
    }

    private User findSeedUser(String role) {
        List<User> users = userRepository.findAll();
        AccessRole accessRole = role.equals("Administrador") ? AccessRole.ADMIN : AccessRole.INVENTORY_MANAGER;
        return users.stream().filter(user -> user.getRole() == accessRole).findFirst().orElse(users.getFirst());
    }

    private void saveSeedMovement(Product product, User user, MovementType type, int quantity,
            MovementPurpose purpose, String reason, LocalDate date) {
        movementRepository.save(Movement.builder().product(product).user(user).type(type)
                .quantity(BigDecimal.valueOf(quantity)).purpose(purpose).reason(reason).movementDate(date).build());
    }

    private void seedTelevisionAssets() {
        Product televisions = productRepository.findByCode("P-2001").orElseThrow();
        if (assetRepository.countByProduct_IdAndStatusNot(televisions.getId(), AssetStatus.RETIRED) > 0) return;
        StorageArea cameras = findArea("Cámaras");
        StorageArea administration = findArea("Administración");
        User admin = findSeedUser("Administrador");
        User manager = findSeedUser("Encargado");
        for (int index = 1; index <= 4; index++) {
            boolean inCameras = index <= 2;
            InventoryAsset asset = assetRepository.save(InventoryAsset.builder().product(televisions)
                    .assetCode("TV-PLH-%03d".formatted(index)).serialNumber("SN-TV-%03d".formatted(index))
                    .area(inCameras ? cameras : administration).responsible(inCameras ? admin : manager)
                    .condition(ItemCondition.GOOD).status(AssetStatus.ASSIGNED).build());
            movementRepository.save(Movement.builder().product(televisions).user(admin)
                    .receivedBy(inCameras ? admin : manager).area(inCameras ? cameras : administration)
                    .asset(asset)
                    .type(MovementType.SALIDA).quantity(BigDecimal.ONE)
                    .purpose(MovementPurpose.ASSET_ASSIGNMENT).reason("Registro y asignación inicial")
                    .conditionBefore(ItemCondition.GOOD).conditionAfter(ItemCondition.GOOD)
                    .movementDate(LocalDate.now()).build());
        }
    }

    private StorageArea findArea(String name) {
        return areaRepository.findAllByActiveTrueOrderByNameAsc().stream()
                .filter(area -> area.getName().equals(name)).findFirst().orElseThrow();
    }
}
