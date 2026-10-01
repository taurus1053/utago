package com.utago.wordbook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.utago.board.WordbookPost;
import com.utago.board.WordbookPostRepository;
import com.utago.common.Lang;
import com.utago.content.Visibility;
import com.utago.user.Role;
import com.utago.user.User;
import com.utago.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * 서버 기동 시 한 번, 번들된 JLPT N3 단어 체크북(출처: 시중 교재 "일단 합격 JLPT N3" 단어장
 * 부분 — 한자 읽기 섹션만 발췌, 352단어)을 운영진(ADMIN) 계정의 "JLPT N3 단어장"이라는
 * 이름의 단어장에 채워 넣는다. 아직 "공식 단어장 카탈로그/다운로드" 기능 자체는 없고
 * (claude/소셜_마이페이지_기획.md 참고, 추후 구현 예정), 우선 실제 데이터로 된 단어장을
 * 하나 만들어서 운영진 본인 계정에서 눈으로 확인·공유해볼 수 있게 하는 1차 단계.
 *
 * 멱등적 — 운영진 계정에 "JLPT N3 단어장"이 이미 있으면 단어는 다시 안 채우고, 게시판
 * 공식 게시물(WordbookPost)만 없으면 채워 넣는다(ensureOfficialPost 참고).
 *
 * 발음(읽기)은 이 리소스에 없음 — WordbookService.addCustomWord가 내부적으로 쓰는
 * resolveOrCreateWord가 JMdict에서 자동으로 찾아 채운다(기존 "단어 직접 추가" 기능과 동일한
 * 경로). JMdict에 표기가 정확히 일치하지 않는 소수 단어(예: な형용사 어미 포함 표기)는
 * 실패할 수 있어 개별적으로 건너뛰고 로그에 남긴다 — 서버 기동 자체는 막지 않는다.
 */
@Component
@RequiredArgsConstructor
public class JlptWordbookSeedRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(JlptWordbookSeedRunner.class);
    private static final String RESOURCE_PATH = "/dictionary/jlpt_n3_checklist.json";
    private static final String WORDBOOK_NAME = "JLPT N3 단어장";

    private final UserRepository userRepository;
    private final WordbookRepository wordbookRepository;
    private final WordbookService wordbookService;
    private final WordbookPostRepository wordbookPostRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private record Entry(String lemma, List<String> meanings) {}

    @Override
    // 주의: 여기에 @Transactional을 붙이면 안 된다 — 아래 루프에서 호출하는
    // wordbookService.addCustomWord()도 @Transactional(기본 전파=REQUIRED)이라, run()까지
    // 트랜잭션이 걸려있으면 둘이 같은 트랜잭션을 공유하게 된다. 그러면 사전에 없는 단어 하나만
    // 실패해도(흔한 일 — 352개 중 수십 개는 JMdict에 표기가 정확히 일치하지 않음) 그 순간
    // Spring이 트랜잭션을 rollback-only로 표시해버려서, 아래 try/catch로 예외를 잡아 넘어가도
    // 결국 run()이 끝나고 커밋하려는 시점에 UnexpectedRollbackException으로 부팅 자체가
    // 실패한다. run()을 트랜잭션 없이 두면 createWordbook/addCustomWord/save가 각자 자기
    // 메서드의 @Transactional로 독립된 트랜잭션에서 커밋되므로, 단어 하나의 실패가 나머지나
    // 단어장 생성 자체에 영향을 주지 않는다.
    public void run(String... args) {
        User admin = userRepository.findFirstByRole(Role.ADMIN).orElse(null);
        if (admin == null) {
            log.info("[JlptWordbookSeedRunner] ADMIN 계정이 아직 없어 JLPT N3 단어장 시딩을 건너뜀 "
                    + "(본인 계정을 'UPDATE users SET role = ''ADMIN'' WHERE email = ...'로 승격 후 재시작)");
            return;
        }

        Wordbook existingBook = wordbookRepository.findByUserId(admin.getId()).stream()
                .filter(b -> WORDBOOK_NAME.equals(b.getName()))
                .findFirst()
                .orElse(null);
        if (existingBook != null) {
            // 단어장은 이미 있는데(이전 실행에서 만들어짐) 게시글이 없는 상태일 수 있다 —
            // 예: 이 기능(공식 게시글 자동 등록)이 나중에 추가된 경우. 자가 치유로 채워준다.
            ensureOfficialPost(existingBook, admin, 0);
            return;
        }

        List<Entry> entries = loadEntries();
        if (entries.isEmpty()) {
            log.warn("[JlptWordbookSeedRunner] {} 리소스를 찾을 수 없거나 비어있음 — 건너뜀", RESOURCE_PATH);
            return;
        }

        WordbookResponse book = wordbookService.createWordbook(admin.getId(), WORDBOOK_NAME, null, null);
        // Phase 2(게시판)가 생기기 전이라도, 공식 프리셋 단어장이니 처음부터 공개/공식으로
        // 표시해둔다 — Phase 1 다운로드 API를 바로 이 단어장으로 테스트해볼 수 있다.
        // run() 자체는 더 이상 트랜잭션이 없으므로, 변경 후 save()를 명시적으로 호출해야
        // 실제로 커밋된다(save()는 WordbookRepository 프록시를 통해 호출돼서 그 자체로
        // 독립된 트랜잭션을 연다).
        wordbookRepository.findById(book.id()).ifPresent(wb -> {
            wb.setOfficial(true);
            wb.setVisibility(Visibility.PUBLIC);
            wordbookRepository.save(wb);
        });

        int added = 0;
        List<String> failed = new ArrayList<>();
        for (Entry entry : entries) {
            try {
                wordbookService.addCustomWord(
                        admin.getId(), entry.lemma(), Lang.JA, book.id(), null, entry.meanings());
                added++;
            } catch (Exception e) {
                failed.add(entry.lemma() + "(" + e.getMessage() + ")");
            }
        }

        log.info("[JlptWordbookSeedRunner] JLPT N3 단어장 시딩 완료 — {}/{}개 추가", added, entries.size());
        if (!failed.isEmpty()) {
            log.warn("[JlptWordbookSeedRunner] 추가 실패 {}건: {}", failed.size(), failed);
        }

        final int addedCount = added; // 람다에서 쓰려면 effectively final이어야 함 — added는 루프에서 계속 바뀌므로 복사.
        wordbookRepository.findById(book.id())
                .ifPresent(wb -> ensureOfficialPost(wb, admin, addedCount));
    }

    /**
     * Phase 2(게시판) 연동 — 시딩한 JLPT N3 단어장을 운영진 명의의 공식 게시물로도 올려서,
     * "단어장 둘러보기" 게시판에서 바로 보이고 다운로드(복사)할 수 있게 한다. 이미 이 단어장에
     * 붙은 게시물이 있으면 중복으로 또 만들지 않는다(멱등적).
     */
    private void ensureOfficialPost(Wordbook wordbook, User admin, int wordCount) {
        if (!wordbookPostRepository.findByWordbookId(wordbook.getId()).isEmpty()) {
            return;
        }
        String body = wordCount > 0
                ? "JLPT N3 필수 단어 " + wordCount + "개를 한자 읽기 중심으로 정리한 공식 단어장이에요."
                : "JLPT N3 필수 단어를 한자 읽기 중심으로 정리한 공식 단어장이에요.";
        wordbookPostRepository.save(WordbookPost.builder()
                .wordbook(wordbook)
                .author(admin)
                .title(WORDBOOK_NAME)
                .body(body)
                .official(true)
                .build());
    }

    private List<Entry> loadEntries() {
        try (InputStream in = getClass().getResourceAsStream(RESOURCE_PATH)) {
            if (in == null) {
                return List.of();
            }
            List<RawEntry> raw = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, RawEntry.class));
            List<Entry> entries = new ArrayList<>(raw.size());
            for (RawEntry r : raw) {
                entries.add(new Entry(r.lemma, r.meanings == null ? List.of() : r.meanings));
            }
            return entries;
        } catch (Exception e) {
            log.error("[JlptWordbookSeedRunner] {} 로드 실패", RESOURCE_PATH, e);
            return List.of();
        }
    }

    static class RawEntry {
        public String lemma;
        public List<String> meanings;
    }
}
