-- 止める는 문맥에 따라 とめる(물리적으로 멈추다) 또는 やめる(그만두다)로 읽히는
-- 한자 동형이의어다. Kuromoji 형태소 분석기가 기본적으로 とめる만 골라서, 곡 등록 시점에
-- 단어(Word) 테이블에 잘못된 읽기가 캐시되어 버렸다(예: 東京フラッシュ의 "もう止めにしようか").
--
-- JapaneseTokenizerService에 추가된 문맥 기반 자동 보정 규칙은 "앞으로 새로 등록되는" 단어에는
-- 바로 적용되지만, 이미 저장되어 재사용 중인 기존 Word 행은 코드 변경만으로는 고쳐지지 않으므로
-- (같은 lemma는 여러 곡에서 공유/재사용되는 구조) 여기서 한 번 데이터를 보정한다.
UPDATE words
SET reading = REPLACE(reading, 'とめ', 'やめ')
WHERE lemma = '止める' AND lang = 'JA' AND reading LIKE 'とめ%';
