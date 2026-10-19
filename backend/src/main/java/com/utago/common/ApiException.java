package com.utago.common;

import java.util.Map;

/**
 * 화면에 그대로 보여줄 수 있는 도메인 에러 — 다국어 UI 때문에 만들었다.
 *
 * <p>message는 예전처럼 한국어 문구를 그대로 둔다(관리자 화면처럼 번역하지 않는 곳과, 코드가 없는
 * 옛 클라이언트의 대체 문구). 프론트는 code(예: "wordbook.notFound")로 현재 표시 언어의 문구를
 * 찾고, 문구에 끼워 넣을 값(날짜 등)은 params로 받는다. 번역 키는 프론트의
 * locales/&lt;언어&gt;/errors.json 의 "api.&lt;code&gt;" 이다.
 *
 * <p>IllegalStateException을 상속하므로, 기존에 IllegalStateException을 잡던 코드(컨트롤러의
 * catch 등)와 GlobalExceptionHandler 동작은 그대로 유지된다.
 */
public class ApiException extends IllegalStateException {

    private final String code;
    private final Map<String, String> params;

    public ApiException(String code, String message) {
        this(code, message, Map.of());
    }

    public ApiException(String code, String message, Map<String, String> params) {
        super(message);
        this.code = code;
        this.params = params;
    }

    public String getCode() {
        return code;
    }

    public Map<String, String> getParams() {
        return params;
    }

    /** 응답 본문: { message, code, params? } — params는 비어있으면 생략한다. */
    public static Map<String, Object> body(IllegalStateException e) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("message", e.getMessage());
        if (e instanceof ApiException api) {
            body.put("code", api.code);
            if (!api.params.isEmpty()) body.put("params", api.params);
        }
        return body;
    }
}
