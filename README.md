# 우타고 (Utago)

좋아하는 노래의 가사를 통해 언어를 공부하는 앱. 일본어부터 시작해서 한국어, 영어까지 다국어 지원 예정.

- **이름 유래**: 歌(uta, 노래) + 語(go, 언어)
- **기획 문서**: [`docs/기획_정리.md`](./docs/기획_정리.md)

## 프로젝트 구조

```
utago/
├── docs/            # 기획/요구사항/설계 문서
├── backend/         # Spring Boot REST API (Java)
└── frontend-web/    # React 웹 클라이언트 (JavaScript, Vite)
```

백엔드는 순수 REST API로만 동작합니다. 프론트엔드는 지금은 웹(React)만 있지만,
같은 API를 그대로 재사용해서 나중에 모바일 앱(React Native 등)을 추가할 수 있도록
설계되어 있습니다 (인증은 세션이 아니라 토큰 기반, 응답은 순수 JSON).

## 시작하기

### 1. 백엔드 실행

```bash
cd backend
cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
#   -> DB 계정, API 키 등 입력 (이 파일은 git에 커밋되지 않습니다)

# MySQL 8 실행 후
./gradlew bootRun     # http://localhost:8080  (프로파일: local)
```

### 2. 프론트엔드 실행

```bash
cd frontend-web
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## 기술 스택

| 영역 | 스택 |
|---|---|
| 백엔드 | Java 21, Spring Boot, Spring Data JPA, MySQL |
| 프론트엔드(웹) | React, Vite, JavaScript |
| 프론트엔드(모바일) | 추후 추가 예정 (React Native 등, 같은 백엔드 API 재사용) |
