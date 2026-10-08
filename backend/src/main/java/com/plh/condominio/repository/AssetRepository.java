package com.plh.condominio.repository;

import com.plh.condominio.entity.AssetStatus;
import com.plh.condominio.entity.InventoryAsset;
import java.util.List;
import java.util.Collection;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetRepository extends JpaRepository<InventoryAsset, Long> {
    List<InventoryAsset> findAllByOrderByAssetCodeAsc();
    List<InventoryAsset> findAllByProduct_IdOrderByAssetCodeAsc(Long productId);
    Optional<InventoryAsset> findByQrToken(String qrToken);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from InventoryAsset a where a.id = :id")
    Optional<InventoryAsset> findByIdForUpdate(@Param("id") Long id);
    boolean existsByAssetCode(String assetCode);
    long countByProduct_IdAndStatus(Long productId, AssetStatus status);
    long countByProduct_IdAndStatusIn(Long productId, Collection<AssetStatus> statuses);

    long countByProduct_IdAndStatusNot(Long productId, AssetStatus status);

    long countByProduct_Id(Long productId);
}
