package com.utago.board;

// POST /api/board/posts — wordbookId는 글쓴이 본인 소유의 즐겨찾기 아닌 단어장이어야 한다.
// 글을 올리는 순간 그 단어장의 visibility가 PUBLIC으로 바뀐다(WordbookPostService 참고).
public record CreatePostRequest(Long wordbookId, String title, String body) {}
