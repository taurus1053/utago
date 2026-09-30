-- (1) Kuromoji가 회화체 축약형 "~てる"(= "~ている"에서 い가 빠진 것, 예: "かかってる")를
-- 문맥을 못 읽고 동사 照る(비추다/빛나다, 사전형이 우연히 똑같이 "てる")로 오인식해서
-- 단어장에 잘못 등록된 것들을 정리한다. 이제는 JapaneseTokenizerService가 문맥(직전 토큰이
-- 동사일 때만)을 보고 이런 경우를 vocabWorthy=false로 걸러내므로(이번 배포에 포함) 다시
-- 생기지 않는다. words를 지우면 연결된 word_meanings/word_examples/song_line_words/
-- wordbook_items가 전부 ON DELETE CASCADE로 함께 정리된다(V1__init_schema.sql 참고).
DELETE FROM words WHERE lang = 'JA' AND lemma = '照る';

-- (2) 순수 숫자("4" 등)가 명사로 오인식되어 등록된 것들도 정리한다. 뜻이 없으므로("뜻 준비
-- 중") 학습에 도움이 안 되고, 숫자 자체는 배울 "일본어 단어"가 아니다.
DELETE FROM words WHERE lang = 'JA' AND lemma REGEXP '^[0-9０-９]+$';
