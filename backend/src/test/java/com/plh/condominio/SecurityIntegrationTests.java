package com.plh.condominio;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import jakarta.servlet.http.Cookie;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.context.WebApplicationContext;
import org.junit.jupiter.api.BeforeEach;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import com.plh.condominio.entity.User;
import com.plh.condominio.repository.UserRepository;

@SpringBootTest
@WebAppConfiguration
@ActiveProfiles({"h2", "demo"})
class SecurityIntegrationTests {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    void apiRequiresAnAuthenticatedSession() throws Exception {
        mockMvc.perform(get("/api/products")).andExpect(status().isUnauthorized());
    }

    @Test
    void csrfBootstrapEndpointIsAvailableBeforeLogin() throws Exception {
        mockMvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.token").isNotEmpty());
    }

    @Test
    void viewersCannotReadAccountEmailsOrAccessAdministration() throws Exception {
        mockMvc.perform(get("/api/users").with(user("viewer").roles("VIEWER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/products/1/ledger").with(user("viewer").roles("VIEWER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/people").with(user("viewer").roles("VIEWER")))
                .andExpect(status().isOk());
    }

    @Test
    void stateChangingRequestsRequireCsrfEvenForAdministrators() throws Exception {
        String request = """
                {"name":"Pruebas de seguridad","description":"Área temporal"}
                """;
        mockMvc.perform(post("/api/areas").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/areas").with(user("admin").roles("ADMIN")).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isCreated());
    }

    @Test
    void loginRejectsInvalidCredentialsAndPersistsAuthenticatedSession() throws Exception {
        mockMvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"maria@condominio.com","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized());

        MockHttpSession previousSession = new MockHttpSession();
        String previousSessionId = previousSession.getId();
        MvcResult login = mockMvc.perform(post("/api/auth/login").session(previousSession).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"maria@condominio.com","password":"DemoPassword123!"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession authenticatedSession = (MockHttpSession) login.getRequest().getSession(false);
        org.junit.jupiter.api.Assertions.assertNotNull(authenticatedSession);
        org.junit.jupiter.api.Assertions.assertNotEquals(previousSessionId, authenticatedSession.getId());
        Cookie csrfCookie = login.getResponse().getCookie("XSRF-TOKEN");
        org.junit.jupiter.api.Assertions.assertNotNull(csrfCookie);
        org.junit.jupiter.api.Assertions.assertFalse(csrfCookie.getMaxAge() == 0);
        org.junit.jupiter.api.Assertions.assertFalse(csrfCookie.getValue().isBlank());
        mockMvc.perform(get("/api/auth/me").session(authenticatedSession))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/users").session(authenticatedSession))
                .andExpect(status().isOk());
        MvcResult postLoginMutation = mockMvc.perform(post("/api/areas").session(authenticatedSession).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"CSRF post-login","description":"Token rotado al autenticar"}
                                """))
                .andReturn();
        org.junit.jupiter.api.Assertions.assertEquals(201, postLoginMutation.getResponse().getStatus(),
                postLoginMutation.getResponse().getContentAsString());
    }

    @Test
    @Transactional
    void disabledAccountCannotKeepUsingAnExistingSession() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"pedro@condominio.com","password":"DemoPassword123!"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        mockMvc.perform(get("/api/products").session(session)).andExpect(status().isOk());

        User manager = userRepository.findByEmailIgnoreCase("pedro@condominio.com").orElseThrow();
        manager.setEnabled(false);
        userRepository.saveAndFlush(manager);

        mockMvc.perform(get("/api/products").session(session)).andExpect(status().isUnauthorized());
    }
}
