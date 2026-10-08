package com.plh.condominio.repository;

import com.plh.condominio.entity.LoanLine;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoanLineRepository extends JpaRepository<LoanLine, Long> {
    boolean existsByProduct_Id(Long productId);
}
