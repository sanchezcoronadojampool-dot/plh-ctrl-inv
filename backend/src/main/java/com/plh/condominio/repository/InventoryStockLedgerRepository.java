package com.plh.condominio.repository;

import com.plh.condominio.entity.InventoryStockLedgerEntry;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface InventoryStockLedgerRepository extends JpaRepository<InventoryStockLedgerEntry, Long> {
    List<InventoryStockLedgerEntry> findAllByProduct_IdOrderByCreatedAtDescIdDesc(Long productId);
    boolean existsByProduct_Id(Long productId);

    @Query("select entry.product.id, coalesce(sum(entry.quantityDelta), 0) from InventoryStockLedgerEntry entry group by entry.product.id")
    List<Object[]> getBalancesByProduct();
}
