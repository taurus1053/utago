package com.utago.board;

import com.utago.content.Visibility;
import com.utago.notification.NotificationService;
import com.utago.user.User;
import com.utago.user.UserRepository;
import com.utago.wordbook.Wordbook;
import com.utago.wordbook.WordbookItem;
import com.utago.wordbook.WordbookItemRepository;
import com.utago.wordbook.WordbookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * "단어장 둘러보기" 게시판 — 단어장(Wordbook)에 제목/본문을 붙여 올리고, 댓글/좋아요를
 * 다는 기능(claude/소셜_마이페이지_기획.md 2번 항목, Phase 2).
 *
 * like_count/comment_count/save_count는 WordbookPost에 캐시해두고 여기서 직접 증감한다 —
 * 매번 COUNT 쿼리를 날리지 않고 목록 화면에서 바로 정렬/표시할 수 있게 하기 위함(V23). 다운로드
 * 수는 별도 캐시를 두지 않고 wordbook.download_count를 그대로 보여준다(V21 마이그레이션 주석 참고).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WordbookPostService {

    private static final int PREVIEW_LEMMA_LIMIT = 5;

    private final WordbookPostRepository postRepository;
    private final WordbookPostCommentRepository commentRepository;
    private final WordbookPostLikeRepository likeRepository;
    private final WordbookPostSaveRepository saveRepository;
    private final WordbookRepository wordbookRepository;
    private final WordbookItemRepository wordbookItemRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public Page<PostSummaryResponse> listPosts(String sort, int page, int size, Long viewerUserId) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        Page<WordbookPost> posts = switch (sort == null ? "latest" : sort) {
            case "popular" -> postRepository.findAllByOrderByOfficialDescLikeCountDescCreatedAtDesc(pageable);
            case "downloads" -> postRepository.findAllByOrderByOfficialDescWordbook_DownloadCountDescCreatedAtDesc(pageable);
            default -> postRepository.findAllByOrderByOfficialDescCreatedAtDesc(pageable);
        };

        List<Long> postIds = posts.getContent().stream().map(WordbookPost::getId).toList();
        Set<Long> likedPostIds = viewerUserId == null
                ? Set.of()
                : likeRepository.findByUserIdAndPostIdIn(viewerUserId, postIds).stream()
                        .map(like -> like.getPost().getId())
                        .collect(Collectors.toSet());

        return posts.map(post -> toSummary(post, likedPostIds.contains(post.getId())));
    }

    /** 마이페이지 "내가 올린 게시글" — 최신순. */
    public List<PostSummaryResponse> listMyPosts(Long userId) {
        List<WordbookPost> posts = postRepository.findByAuthorIdOrderByCreatedAtDesc(userId);
        return toSummaryList(posts, userId);
    }

    /** 마이페이지 "저장한 게시글" — 저장한 순(최근 저장이 위). 폴더 분류는 아직 없음(V22 주석 참고). */
    public List<PostSummaryResponse> listSavedPosts(Long userId) {
        List<WordbookPost> posts = saveRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(WordbookPostSave::getPost)
                .toList();
        return toSummaryList(posts, userId);
    }

    private List<PostSummaryResponse> toSummaryList(List<WordbookPost> posts, Long viewerUserId) {
        List<Long> postIds = posts.stream().map(WordbookPost::getId).toList();
        Set<Long> likedPostIds = viewerUserId == null
                ? Set.of()
                : likeRepository.findByUserIdAndPostIdIn(viewerUserId, postIds).stream()
                        .map(like -> like.getPost().getId())
                        .collect(Collectors.toSet());
        return posts.stream().map(post -> toSummary(post, likedPostIds.contains(post.getId()))).toList();
    }

    public PostDetailResponse getPost(Long postId, Long viewerUserId) {
        WordbookPost post = requirePost(postId);
        boolean liked = viewerUserId != null && likeRepository.existsByPostIdAndUserId(postId, viewerUserId);
        boolean saved = viewerUserId != null && saveRepository.existsByPostIdAndUserId(postId, viewerUserId);
        List<CommentResponse> comments = commentRepository.findByPostIdOrderByCreatedAtAsc(postId).stream()
                .map(c -> CommentResponse.of(c, viewerUserId))
                .toList();
        Wordbook wordbook = post.getWordbook();
        return new PostDetailResponse(
                post.getId(),
                post.getTitle(),
                post.getBody(),
                post.getAuthor().getNickname(),
                viewerUserId != null && viewerUserId.equals(post.getAuthor().getId()),
                post.isOfficial(),
                post.getCreatedAt(),
                post.getLikeCount(),
                post.getCommentCount(),
                wordbook.getDownloadCount(),
                liked,
                saved,
                wordbook.getId(),
                wordbook.getName(),
                wordbook.getEmoji(),
                itemCount(wordbook.getId()),
                previewLemmas(wordbook.getId()),
                comments);
    }

    /**
     * 글쓰기 — 본인 소유의(즐겨찾기 아닌) 단어장 하나를 골라 제목/본문을 붙인다. 올리는 순간
     * 그 단어장을 PUBLIC으로 전환한다(비공개로는 게시판에 올릴 수 없으므로).
     */
    @Transactional
    public PostDetailResponse createPost(Long userId, Long wordbookId, String title, String body) {
        if (title == null || title.isBlank()) {
            throw new IllegalStateException("제목을 입력해주세요.");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("내용을 입력해주세요.");
        }
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        Wordbook wordbook = wordbookRepository.findById(wordbookId)
                .orElseThrow(() -> new IllegalStateException("단어장을 찾을 수 없어요."));
        if (!wordbook.getUser().getId().equals(userId)) {
            throw new IllegalStateException("본인 단어장만 게시할 수 있어요.");
        }
        if (wordbook.isFavoriteDefault()) {
            throw new IllegalStateException("즐겨찾기 단어장은 게시할 수 없어요.");
        }

        wordbook.setVisibility(Visibility.PUBLIC);

        WordbookPost post = postRepository.save(WordbookPost.builder()
                .wordbook(wordbook)
                .author(author)
                .title(title.trim())
                .body(body.trim())
                .build());

        return getPost(post.getId(), userId);
    }

    /** 작성자 본인만 삭제 가능 — 컨트롤러에서 403으로 remap. */
    @Transactional
    public void deletePost(Long userId, Long postId) {
        WordbookPost post = requirePost(postId);
        if (!post.getAuthor().getId().equals(userId)) {
            throw new IllegalStateException("본인 게시글만 삭제할 수 있어요.");
        }
        postRepository.delete(post); // ON DELETE CASCADE로 댓글/좋아요도 함께 삭제됨(V21)
    }

    /**
     * parentCommentId가 있으면 답글(대댓글, claude/소셜_마이페이지_기획.md 24번) — 답글은
     * 1단계 깊이만 허용(답글에는 답글을 달 수 없음), 부모 댓글과 같은 게시글이어야 한다.
     * 알림은 답글이면 "원댓글 작성자"에게만(POST_COMMENT는 생략 — 게시글 작성자가 곧
     * 원댓글 작성자인 흔한 경우 중복 알림이 가지 않도록), 최상위 댓글이면 기존처럼
     * 게시글 작성자에게 간다.
     */
    @Transactional
    public CommentResponse addComment(Long userId, Long postId, String content, Long parentCommentId) {
        if (content == null || content.isBlank()) {
            throw new IllegalStateException("댓글 내용을 입력해주세요.");
        }
        WordbookPost post = requirePost(postId);
        User author = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));

        WordbookPostComment parent = null;
        if (parentCommentId != null) {
            parent = commentRepository.findById(parentCommentId)
                    .orElseThrow(() -> new IllegalStateException("댓글을 찾을 수 없어요."));
            if (!parent.getPost().getId().equals(postId)) {
                throw new IllegalStateException("같은 게시글의 댓글에만 답글을 달 수 있어요.");
            }
            if (parent.getParent() != null) {
                throw new IllegalStateException("답글에는 답글을 달 수 없어요.");
            }
        }

        WordbookPostComment comment = commentRepository.save(WordbookPostComment.builder()
                .post(post)
                .author(author)
                .content(content.trim())
                .parent(parent)
                .build());
        post.setCommentCount(post.getCommentCount() + 1);

        if (parent != null) {
            notificationService.notifyCommentReply(userId, parent);
        } else {
            notificationService.notifyPostComment(userId, post);
        }
        return CommentResponse.of(comment, userId);
    }

    /** 댓글 작성자 본인만 삭제 가능 — 컨트롤러에서 403으로 remap. 답글이 달려있으면
     * DB가 같이 지워주지만(ON DELETE CASCADE, V35), commentCount 캐시는 직접 맞춘다. */
    @Transactional
    public void deleteComment(Long userId, Long commentId) {
        WordbookPostComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalStateException("댓글을 찾을 수 없어요."));
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new IllegalStateException("본인 댓글만 삭제할 수 있어요.");
        }
        WordbookPost post = comment.getPost();
        long deletedCount = 1 + commentRepository.countByParentId(commentId);
        commentRepository.delete(comment);
        post.setCommentCount(Math.max(0, (int) (post.getCommentCount() - deletedCount)));
    }

    /** 좋아요 토글 — 이미 눌렀으면 취소, 아니면 추가. */
    @Transactional
    public boolean toggleLike(Long userId, Long postId) {
        WordbookPost post = requirePost(postId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        var existing = likeRepository.findByPostIdAndUserId(postId, userId);
        if (existing.isPresent()) {
            likeRepository.delete(existing.get());
            post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
            return false;
        }
        likeRepository.save(WordbookPostLike.builder().post(post).user(user).build());
        post.setLikeCount(post.getLikeCount() + 1);
        notificationService.notifyPostLike(userId, post);
        return true;
    }

    /** 저장(북마크) 토글 — 이미 저장했으면 취소, 아니면 추가. 폴더 분류는 아직 없음(V22 주석 참고). */
    @Transactional
    public boolean toggleSave(Long userId, Long postId) {
        WordbookPost post = requirePost(postId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
        var existing = saveRepository.findByPostIdAndUserId(postId, userId);
        if (existing.isPresent()) {
            saveRepository.delete(existing.get());
            post.setSaveCount(Math.max(0, post.getSaveCount() - 1));
            return false;
        }
        saveRepository.save(WordbookPostSave.builder().post(post).user(user).build());
        post.setSaveCount(post.getSaveCount() + 1);
        return true;
    }

    /** 관리자가 신고 처리로 게시글을 삭제 — 소유권 체크 없음(ReportService 전용, claude/
     * 소셜_마이페이지_기획.md 23번). 일반 삭제(deletePost)와 달리 작성자 본인이 아니어도 된다. */
    @Transactional
    public void adminDeletePost(Long postId) {
        WordbookPost post = requirePost(postId);
        postRepository.delete(post); // ON DELETE CASCADE로 댓글/좋아요도 함께 삭제됨(V21)
    }

    /** 관리자가 신고 처리로 댓글을 삭제 — 소유권 체크 없음(ReportService 전용). 답글이
     * 달려있으면 같이 지워지므로(V35) commentCount도 그만큼 같이 깎는다. */
    @Transactional
    public void adminDeleteComment(Long commentId) {
        WordbookPostComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalStateException("댓글을 찾을 수 없어요."));
        WordbookPost post = comment.getPost();
        long deletedCount = 1 + commentRepository.countByParentId(commentId);
        commentRepository.delete(comment);
        post.setCommentCount(Math.max(0, (int) (post.getCommentCount() - deletedCount)));
    }

    private WordbookPost requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new IllegalStateException("게시글을 찾을 수 없어요."));
    }

    private PostSummaryResponse toSummary(WordbookPost post, boolean likedByMe) {
        Wordbook wordbook = post.getWordbook();
        return new PostSummaryResponse(
                post.getId(),
                post.getTitle(),
                post.getAuthor().getNickname(),
                post.isOfficial(),
                post.getCreatedAt(),
                post.getLikeCount(),
                post.getCommentCount(),
                wordbook.getDownloadCount(),
                post.getSaveCount(),
                likedByMe,
                wordbook.getId(),
                wordbook.getName(),
                wordbook.getEmoji(),
                itemCount(wordbook.getId()),
                previewLemmas(wordbook.getId()));
    }

    private int itemCount(Long wordbookId) {
        return wordbookItemRepository.findByWordbookId(wordbookId).size();
    }

    private List<String> previewLemmas(Long wordbookId) {
        return wordbookItemRepository.findByWordbookId(wordbookId).stream()
                .map(item -> item.getWord().getLemma())
                .limit(PREVIEW_LEMMA_LIMIT)
                .toList();
    }
}
