package com.utago.dictionary;

import com.utago.common.Lang;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class WordController {

    private final WordRepository wordRepository;
    private final WordMeaningRepository wordMeaningRepository;
    private final SongLineWordRepository songLineWordRepository;

    /**
     * 홈 화면 "오늘의 단어" — 단어장에 있고 없고 상관없이, 뜻이 있는 단어 중 아무거나 무작위로
     * 하나 골라서 뜻과(있으면) 실제 가사 예문을 같이 준다. 로그인 필요 — 예문을 고를 때
     * 다른 사용자의 PRIVATE 곡 가사가 섞이지 않도록 요청한 사용자 기준으로 필터링해야 해서다.
     */
    @GetMapping("/api/words/random")
    public ResponseEntity<WordRandomResponse> random(
            @RequestParam(defaultValue = "JA") Lang lang, Authentication authentication
    ) {
        Long userId = extractUserId(authentication);
        if (userId == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        return wordRepository.findRandomWithMeaningByLang(lang.name())
                .map(word -> {
                    List<WordMeaning> meanings = wordMeaningRepository.findByWordIdOrderByDisplayOrderAsc(word.getId());
                    List<SongLineWord> examples = songLineWordRepository
                            .findVisibleExamplesByWordIdIn(List.of(word.getId()), userId);
                    SongLineWord example = examples.isEmpty() ? null : examples.get(0);
                    return ResponseEntity.ok(WordRandomResponse.of(word, meanings, example));
                })
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    private Long extractUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Long userId) return userId;
        return null;
    }
}
