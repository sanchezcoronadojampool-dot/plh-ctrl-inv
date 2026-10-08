package com.plh.condominio.repository;

import com.plh.condominio.entity.Loan;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LoanRepository extends JpaRepository<Loan, Long> {
    @EntityGraph(attributePaths = {"borrower", "issuedBy", "area", "lines", "lines.product"})
    List<Loan> findAllByOrderByIssuedAtDesc();

    @EntityGraph(attributePaths = {"borrower", "issuedBy", "area", "lines", "lines.product"})
    Optional<Loan> findWithDetailsById(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Loan l where l.id = :id")
    Optional<Loan> findByIdForUpdate(@Param("id") Long id);
}
