package com.utago.user;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * users 테이블과 1:1. PK를 user_id 그대로 공유한다 (별도 auto-increment id 없음).
 */
@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSettings {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "dark_mode", nullable = false)
    @Builder.Default
    private boolean darkMode = false;

    @Column(name = "font_size_step", nullable = false)
    @Builder.Default
    private int fontSizeStep = 0;

    @Column(name = "furigana_default_on", nullable = false)
    @Builder.Default
    private boolean furiganaDefaultOn = true;

    @Column(name = "spotify_account_linked", length = 120)
    private String spotifyAccountLinked;

    @Column(name = "apple_music_account_linked", length = 120)
    private String appleMusicAccountLinked;
}
