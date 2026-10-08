package com.plh.condominio.repository;

import com.plh.condominio.entity.User;
import com.plh.condominio.entity.AccessRole;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    long countByRoleAndEnabledTrue(AccessRole role);
    List<User> findAllByEnabledTrueOrderByFullNameAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.role = :role and u.enabled = true")
    List<User> findActiveByRoleForUpdate(@Param("role") AccessRole role);
}
