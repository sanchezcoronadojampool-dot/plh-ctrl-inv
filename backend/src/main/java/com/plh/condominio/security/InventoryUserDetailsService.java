package com.plh.condominio.security;

import com.plh.condominio.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class InventoryUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public InventoryUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmailIgnoreCase(email.trim())
                .filter(user -> user.getPasswordHash() != null && user.getEnabled())
                .map(AuthenticatedUser::from)
                .orElseThrow(() -> new UsernameNotFoundException("Credenciales inválidas."));
    }
}
