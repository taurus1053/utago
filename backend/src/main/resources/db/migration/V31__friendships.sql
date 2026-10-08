-- 친구 기능(Phase 3, claude/소셜_마이페이지_기획.md 4번/18번) — Friendship 엔티티.
-- 역방향 중복(한쪽이 이미 요청을 보낸 상태에서 반대쪽도 보내는 것)은 unique 제약만으로는
-- 못 막아서(요청자/수신자가 바뀌면 다른 행으로 취급됨) 애플리케이션 레벨(FriendService)에서
-- OR 조건으로 조회해 막는다.
CREATE TABLE friendships (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    requester_id BIGINT NOT NULL,
    addressee_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at DATETIME NOT NULL,
    responded_at DATETIME NULL,
    CONSTRAINT uq_friendship_pair UNIQUE (requester_id, addressee_id),
    CONSTRAINT fk_friendship_requester FOREIGN KEY (requester_id) REFERENCES users (id),
    CONSTRAINT fk_friendship_addressee FOREIGN KEY (addressee_id) REFERENCES users (id)
);

CREATE INDEX idx_friendship_addressee_status ON friendships (addressee_id, status);
CREATE INDEX idx_friendship_requester_status ON friendships (requester_id, status);
