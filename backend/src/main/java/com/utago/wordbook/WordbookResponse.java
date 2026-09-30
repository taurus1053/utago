package com.utago.wordbook;

// 단어장 목록 화면(마이페이지 > 단어장) 카드 하나.
public record WordbookResponse(Long id, String name, boolean favoriteDefault, int itemCount, Long folderId) {
    public static WordbookResponse of(Wordbook wordbook, int itemCount) {
        return new WordbookResponse(
                wordbook.getId(),
                wordbook.getName(),
                wordbook.isFavoriteDefault(),
                itemCount,
                wordbook.getFolder() != null ? wordbook.getFolder().getId() : null);
    }
}
