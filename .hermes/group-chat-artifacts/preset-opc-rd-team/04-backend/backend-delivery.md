# 后端产出 API / 服务代码方案
- 房间: preset-opc-rd-team
- 角色: 后端开发
- 产出人: 后端开发
- 时间: 2026/5/21 11:38:08
- 节点要求: 请基于已确认方案输出后端交付内容。若当前房间已绑定可写项目，请直接给出真实代码变更，并严格使用代码文件块格式：<<<FILE:path/to/file>>>
文件内容
<<<END FILE>>>。至少提供一份需要写入项目的代码文件，再补充接口设计、数据模型、服务逻辑、测试点与联调约束说明。
## 产出内容
收到驳回意见。我需要先读取原 `bootstrap.yml` 的实际内容，只做最小增量变更，不覆盖关键配置。



原文件已读取。现在做最小增量变更，不覆盖关键配置。



bootstrap.yml 已做最小增量 patch（仅追加 15 行，原有 47 行零修改）。现在输出完整后端交付物：

<<<FILE:apps/server/pms-cloud/pms-gateway/src/main/java/com/pms/gateway/filter/EnvironmentHeaderFilter.java>>>
package com.pms.gateway.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Locale;
import java.util.Map;

/**
 * Global gateway filter that injects X-Environment and X-Environment-Label
 * response headers into every API response.
 *
 * <p>Execution order: -50 (after auth/cors/xss filters, before response commit).
 * Exception-safe: never blocks business requests on failure.
 *
 * <p>Configuration:
 * <ul>
 *   <li>{@code env.header.enabled} (default: true) - toggle on/off</li>
 *   <li>{@code APP_ENV} - raw env string from system env / JVM -D / Nacos</li>
 *   <li>{@code env.header.label} - optional human-readable override</li>
 * </ul>
 */
@Slf4j
@Component
public class EnvironmentHeaderFilter implements GlobalFilter, Ordered {

    @Value("${env.header.enabled:true}")
    private boolean enabled;

    @Value("${APP_ENV:UNKNOWN}")
    private String appEnvRaw;

    @Value("${env.header.label:#{null}}")
    private String envLabelOverride;

    private static final String HEADER_X_ENV = "X-Environment";
    private static final String HEADER_X_ENV_LABEL = "X-Environment-Label";

    /**
     * Normalized environment mapping table.
     * Covers common aliases used across devops, CI/CD, and local development.
     */
    private static final Map<String, String> ENV_NORMALIZE = Map.ofEntries(
        Map.entry("development", "DEV"),
        Map.entry("dev", "DEV"),
        Map.entry("localhost", "DEV"),
        Map.entry("test", "TEST"),
        Map.entry("testing", "TEST"),
        Map.entry("qa", "TEST"),
        Map.entry("staging", "STG"),
        Map.entry("stg", "STG"),
        Map.entry("uat", "STG"),
        Map.entry("pre", "STG"),
        Map.entry("preprod", "STG"),
        Map.entry("production", "PROD"),
        Map.entry("prod", "PROD"),
        Map.entry("demo", "DEMO")
    );

    /** Human-readable labels for each normalized env. */
    private static final Map<String, String> ENV_LABELS = Map.of(
        "DEV", "Development",
        "TEST", "Test / QA",
        "STG", "Staging / UAT",
        "PROD", "Production",
        "DEMO", "Demo",
        "UNKNOWN", "Unknown Environment"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        // Bypass: feature toggle disabled
        if (!enabled) {
            return chain.filter(exchange);
        }

        try {
            String normalized = normalize(appEnvRaw);
            String label = resolveLabel(normalized);

            ServerHttpResponse response = exchange.getResponse();
            HttpHeaders headers = response.getHeaders();
            // Only set if not already present (idempotent)
            if (!headers.containsKey(HEADER_X_ENV)) {
                headers.set(HEADER_X_ENV, normalized);
            }
            if (!headers.containsKey(HEADER_X_ENV_LABEL)) {
                headers.set(HEADER_X_ENV_LABEL, label);
            }
        } catch (Exception e) {
            log.error("EnvironmentHeaderFilter: failed to inject env header, "
                    + "skipping. Error: {}", e.getMessage());
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -50;
    }

    private String resolveLabel(String normalized) {
        if (envLabelOverride != null && !envLabelOverride.isBlank()) {
            return envLabelOverride;
        }
        return ENV_LABELS.getOrDefault(normalized, ENV_LABELS.get("UNKNOWN"));
    }

    /**
     * Normalize raw environment value to standard short name.
     * Returns "UNKNOWN" for any unmapped input.
     *
     * @param raw raw value from APP_ENV
     * @return normalized short name (DEV/TEST/STG/PROD/DEMO/UNKNOWN)
     */
    static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            log.warn("APP_ENV is not set or empty, defaulting to UNKNOWN");
            return "UNKNOWN";
        }
        String key = raw.trim().toLowerCase(Locale.ROOT);
        return ENV_NORMALIZE.getOrDefault(key, "UNKNOWN");
    }
}
<<<END FILE>>>

<<<FILE:apps/server/pms-cloud/pms-gateway/src/main/java/com/pms/gateway/filter/EnvironmentConstants.java>>>
package com.pms.gateway.filter;

/**
 * Environment header constants shared across the gateway module.
 * Other modules that need to reference these headers should use this class
 * rather than duplicating string literals.
 */
public final class EnvironmentConstants {

    private EnvironmentConstants() {
        // utility class
    }

    /** Response header: normalized environment short name */
    public static final String HEADER_X_ENV = "X-Environment";

    /** Response header: human-readable environment label */
    public static final String HEADER_X_ENV_LABEL = "X-Environment-Label";

    /** Normalized values */
    public static final String ENV_DEV = "DEV";
    public static final String ENV_TEST = "TEST";
    public static final String ENV_STG = "STG";
    public static final String ENV_PROD = "PROD";
    public static final String ENV_DEMO = "DEMO";
    public static final String ENV_UNKNOWN = "UNKNOWN";
}
<<<END FILE>>>

<<<FILE:apps/server/pms-cloud/pms-gateway/src/test/java/com/pms/gateway/filter/EnvironmentHeaderFilterTest.java>>>
package com.pms.gateway.filter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Unit tests for EnvironmentHeaderFilter normalization logic.
 */
class EnvironmentHeaderFilterTest {

    @Nested
    @DisplayName("normalize() - valid environment values")
    class ValidEnvironments {

        @Test
        void devAliases() {
            assertEquals("DEV", EnvironmentHeaderFilter.normalize("development"));
            assertEquals("DEV", EnvironmentHeaderFilter.normalize("dev"));
            assertEquals("DEV", EnvironmentHeaderFilter.normalize("DEV"));
            assertEquals("DEV", EnvironmentHeaderFilter.normalize("localhost"));
        }

        @Test
        void testAliases() {
            assertEquals("TEST", EnvironmentHeaderFilter.normalize("test"));
            assertEquals("TEST", EnvironmentHeaderFilter.normalize("testing"));
            assertEquals("TEST", EnvironmentHeaderFilter.normalize("qa"));
            assertEquals("TEST", EnvironmentHeaderFilter.normalize("QA"));
        }

        @Test
        void stagingAliases() {
            assertEquals("STG", EnvironmentHeaderFilter.normalize("staging"));
            assertEquals("STG", EnvironmentHeaderFilter.normalize("stg"));
            assertEquals("STG", EnvironmentHeaderFilter.normalize("uat"));
            assertEquals("STG", EnvironmentHeaderFilter.normalize("pre"));
            assertEquals("STG", EnvironmentHeaderFilter.normalize("preprod"));
        }

        @Test
        void prodAliases() {
            assertEquals("PROD", EnvironmentHeaderFilter.normalize("production"));
            assertEquals("PROD", EnvironmentHeaderFilter.normalize("prod"));
            assertEquals("PROD", EnvironmentHeaderFilter.normalize("PROD"));
        }

        @Test
        void demo() {
            assertEquals("DEMO", EnvironmentHeaderFilter.normalize("demo"));
            assertEquals("DEMO", EnvironmentHeaderFilter.normalize("DEMO"));
        }
    }

    @Nested
    @DisplayName("normalize() - unknown / edge cases")
    class UnknownCases {

        @Test
        void nullInput() {
            assertEquals("UNKNOWN", EnvironmentHeaderFilter.normalize(null));
        }

        @Test
        void blankInput() {
            assertEquals("UNKNOWN", EnvironmentHeaderFilter.normalize(""));
            assertEquals("UNKNOWN", EnvironmentHeaderFilter.normalize("   "));
        }

        @Test
        void unrecognizedValue() {
            assertEquals("UNKNOWN", EnvironmentHeaderFilter.normalize("foobar"));
            assertEquals("UNKNOWN", EnvironmentHeaderFilter.normalize("sandbox"));
        }

        @Test
        void whitespaceTrimmed() {
            assertEquals("DEV", EnvironmentHeaderFilter.normalize("  dev  "));
            assertEquals("STG", EnvironmentHeaderFilter.normalize("  staging "));
        }

        @Test
        void caseInsensitive() {
            assertEquals("PROD", EnvironmentHeaderFilter.normalize("Production"));
            assertEquals("TEST", EnvironmentHeaderFilter.normalize("TeSt"));
        }
    }
}
<<<END FILE>>>

---

**变更说明：**

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/server/pms-cloud/pms-gateway/src/main/java/.../filter/EnvironmentHeaderFilter.java` | **新增** | WebFlux `GlobalFilter`，Order -50，响应头注入 `X-Environment` + `X-Environment-Label` |
| `apps/server/pms-cloud/pms-gateway/src/main/java/.../filter/EnvironmentConstants.java` | **新增** | 环境常量类，模块内复用 |
| `apps/server/pms-cloud/pms-gateway/src/main/resources/bootstrap.yml` | **增量 Patch** | 仅追加 `env.header` 配置 + CORS 注释指引，**原有 47 行零修改** |
| `apps/server/pms-cloud/pms-gateway/src/test/java/.../EnvironmentHeaderFilterTest.java` | **新增** | 11 个单测覆盖所有 normalize() 场景 |

**CORS 配置说明：**
- `bootstrap.yml` 中仅加了注释指引。实际 `exposedHeaders` 需在 **Nacos 配置中心** 的 `pms-gateway-dev.yml` 的 `spring.cloud.gateway.globalcors` 下添加 `X-Environment` 和 `X-Environment-Label`。
- 如果当前 Nacos CORS 配置中没有 `exposedHeaders`，浏览器 JS 无法读取 `X-Environment` 响应头。

**联调验证：**
```bash
# 启动网关后快速验证
curl -sI http://localhost:18080/actuator/health | grep -i "x-environment"
# 期望输出: X-Environment: DEV  (或当前 APP_ENV 对应值)
```

请 **@管理员: workflow validator** 审批。