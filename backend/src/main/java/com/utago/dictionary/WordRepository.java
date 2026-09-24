package com.utago.dictionary;

import com.utago.common.Lang;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WordRepository extends JpaRepository<Word, Long> {

    /** 콘텐츠 파이프라인에서 단어 추출 시 마스터 사전에 이미 있는지 확인/재사용 (uk_words_lemma_lang) */
    Optional<Word> findByLemmaAndLang(String lemma, Lang lang);
}
