package com.plh.condominio.repository;

import com.plh.condominio.entity.StorageArea;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AreaRepository extends JpaRepository<StorageArea, Long> {
    List<StorageArea> findAllByActiveTrueOrderByNameAsc();
}
