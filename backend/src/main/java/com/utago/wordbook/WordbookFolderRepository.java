package com.utago.wordbook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WordbookFolderRepository extends JpaRepository<WordbookFolder, Long> {

    List<WordbookFolder> findByUserId(Long userId);
}
