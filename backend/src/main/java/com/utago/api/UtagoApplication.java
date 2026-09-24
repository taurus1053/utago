package com.utago.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * 메인 클래스가 com.utago.api에 있지만, 엔티티/리포지토리/서비스/컨트롤러는
 * com.utago.content, com.utago.user, com.utago.dictionary, com.utago.wordbook,
 * com.utago.common 등 형제 패키지에 나뉘어 있다.
 * @SpringBootApplication 기본 스캔 범위(자기 패키지+하위)만으로는 이들을 못 찾으므로
 * 컴포넌트/엔티티/리포지토리 스캔 범위를 com.utago 전체로 명시적으로 넓힌다.
 */
@SpringBootApplication(scanBasePackages = "com.utago")
@EntityScan(basePackages = "com.utago")
@EnableJpaRepositories(basePackages = "com.utago")
public class UtagoApplication {

    public static void main(String[] args) {
        SpringApplication.run(UtagoApplication.class, args);
    }
}
