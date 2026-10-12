package com.plh.condominio.repository;

import com.plh.condominio.entity.InventoryPerson;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryPersonRepository extends JpaRepository<InventoryPerson, Long> {
    List<InventoryPerson> findAllByActiveTrueOrderByFullNameAsc();

    Optional<InventoryPerson> findByIdAndActiveTrue(Long id);

    boolean existsByFullNameIgnoreCaseAndJobTitleIgnoreCaseAndActiveTrue(String fullName, String jobTitle);
}
