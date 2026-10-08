package com.plh.condominio.repository;

import com.plh.condominio.entity.Movement;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MovementRepository extends JpaRepository<Movement, Long> {
    @EntityGraph(attributePaths = {"product", "user", "receivedBy", "area", "asset", "loan"})
    List<Movement> findAllByOrderByMovementDateDescCreatedAtDesc();

    @EntityGraph(attributePaths = {"product", "user", "receivedBy", "area", "asset", "loan"})
    List<Movement> findAllByAsset_IdOrderByMovementDateDescCreatedAtDesc(Long assetId);

    Optional<Movement> findFirstByAsset_IdOrderByMovementDateDesc(Long assetId);
    long countByMovementDate(LocalDate date);
    boolean existsByUser_Id(Long userId);
    boolean existsByProduct_Id(Long productId);
}
