package com.utago.common;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    /** signup/login 등에서 던지는 "이미 가입됨", "비밀번호 불일치" 같은 도메인 에러 → 400. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException e) {
        // ApiException이면 code/params가 같이 내려간다(다국어 UI — ApiException 참고).
        return ResponseEntity.badRequest().body(ApiException.body(e));
    }

    /** @Valid 검증 실패(비밀번호 규칙 위반 등) → 필드별 에러 메시지. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(fe -> errors.put(fe.getField(), fe.getDefaultMessage()));
        return ResponseEntity.badRequest().body(errors);
    }

    /** @RequestParam/@PathVariable 검증 실패(예: check-nickname 쿼리파라미터) → 400. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, String>> handleConstraintViolation(ConstraintViolationException e) {
        Map<String, String> errors = new LinkedHashMap<>();
        e.getConstraintViolations().forEach(cv ->
                errors.put(cv.getPropertyPath().toString(), cv.getMessage())
        );
        return ResponseEntity.badRequest().body(errors);
    }
}
