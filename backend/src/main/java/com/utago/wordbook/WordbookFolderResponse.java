package com.utago.wordbook;

// 단어장 폴더 목록 화면에 쓰는 폴더 하나.
public record WordbookFolderResponse(Long id, String name) {
    public static WordbookFolderResponse of(WordbookFolder folder) {
        return new WordbookFolderResponse(folder.getId(), folder.getName());
    }
}
