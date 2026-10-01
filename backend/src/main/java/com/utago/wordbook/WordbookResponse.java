package com.utago.wordbook;

import com.utago.content.Visibility;

// 단어장 목록 화면(마이페이지 > 단어장) 카드 하나.
public record WordbookResponse(
        Long id, String name, boolean favoriteDefault, int itemCount, Long folderId,
        boolean isPublic, boolean official, int downloadCount, String emoji
) {
    public static WordbookResponse of(Wordbook wordbook, int itemCount) {
        return new WordbookResponse(
                wordbook.getId(),
                wordbook.getName(),
                wordbook.isFavoriteDefault(),
                itemCount,
                wordbook.getFolder() != null ? wordbook.getFolder().getId() : null,
                wordbook.getVisibility() == Visibility.PUBLIC,
                wordbook.isOfficial(),
                wordbook.getDownloadCount(),
                wordbook.getEmoji());
    }
}
