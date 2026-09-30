-- 형태소 분석기(Kuromoji)가 가사에 섞인 영어 단어(예: "Age")를 일본어 명사로 오인식해서
-- 단어장 후보 단어(words)로 등록해버린 것들을 정리한다. 일본어 학습용 곡에서 로마자로만
-- 된 토큰은 "배울 일본어 단어"가 아니므로(발음/한자 학습 대상이 아니고, 뜻도 채워지지
-- 않아 "뜻 준비 중"으로만 보임) 표제어가 순수 알파벳뿐인 JA 단어는 모두 지운다.
-- words를 지우면 연결된 word_meanings/word_examples/song_line_words/wordbook_items가
-- 전부 ON DELETE CASCADE로 함께 정리된다(V1__init_schema.sql 참고).
-- 앞으로 등록되는 곡은 JapaneseTokenizerService가 이런 토큰을 애초에
-- vocabWorthy=false로 걸러내므로(이번 배포에 포함) 다시 생기지 않는다.
DELETE FROM words WHERE lang = 'JA' AND lemma REGEXP '^[A-Za-z]+$';
