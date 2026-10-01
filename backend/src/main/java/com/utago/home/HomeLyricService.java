package com.utago.home;

import com.utago.content.Song;
import com.utago.content.SongLine;
import com.utago.content.SongLineRepository;
import com.utago.content.SongRepository;
import com.utago.dictionary.SongLineWord;
import com.utago.dictionary.SongLineWordRepository;
import com.utago.dictionary.Word;
import com.utago.dictionary.WordMeaning;
import com.utago.dictionary.WordMeaningRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 홈 화면 "오늘의 추천곡" / "가사 복습하기" 카드용 서비스.
 *
 * "오늘의 가사"는 원래 단어장과 무관하게 아무 공개 곡에서나 가사 원문을 무작위로 뽑아
 * 보여줬는데, 사용자 본인이 학습 중인 맥락과 무관하게 임의의 가사 텍스트를 노출하는 건
 * 저작권 리스크가 더 크다고 판단해 — 가사 원문/번역은 전혀 내려주지 않고 "곡 자체"만
 * 추천하는 오늘의 추천곡으로 바꿨다(가사 텍스트는 유튜브 썸네일+링크로 대체). 그마저도
 * "아무 공개 곡"이 아니라, 관리자가 미리 골라서 featured=true로 지정해둔 곡들 중에서만
 * 고른다(AdminSongController의 추천곡 관리 API — 어떤 곡을 추천곡 후보로 올릴지도
 * 관리자가 직접 통제하도록 해 저작권 리스크를 한 번 더 낮췄다).
 * 가사 복습하기는 내 단어장에 실제로 담은 단어가 등장하는 소절을 본인이 복습하는
 * 기능이라 원래 의도(개인 학습 맥락) 그대로 유지한다.
 *
 * 두 경우 모두 다른 사용자의 PRIVATE 곡이 섞이지 않도록 같은 가시성 규칙(공개+게시됨
 * 또는 본인 소유)을 쓴다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HomeLyricService {

    private final SongRepository songRepository;
    private final SongLineRepository songLineRepository;
    private final SongLineWordRepository songLineWordRepository;
    private final WordMeaningRepository wordMeaningRepository;

    public Optional<SongOfDayResponse> getRandomSongOfDay(Long userId) {
        return songRepository.findRandomFeaturedSong(userId).map(song -> new SongOfDayResponse(
                song.getId(), song.getTitle(), song.getArtist(), song.getSourceLang(), song.getYoutubeVideoId()
        ));
    }

    public Optional<LyricLineResponse> getRandomLyricReview(Long userId) {
        return songLineRepository.findRandomReviewLineForUser(userId).map(this::toResponse);
    }

    private LyricLineResponse toResponse(SongLine line) {
        List<SongLineWord> slws = songLineWordRepository.findBySongLineId(line.getId());
        List<Long> wordIds = slws.stream().map(slw -> slw.getWord().getId()).distinct().toList();
        Map<Long, List<WordMeaning>> meaningsByWordId = wordMeaningRepository
                .findByWordIdInOrderByDisplayOrderAsc(wordIds).stream()
                .collect(Collectors.groupingBy(m -> m.getWord().getId()));

        List<LyricWordSpan> words = slws.stream()
                .sorted((a, b) -> Integer.compare(a.getCharOffsetStart(), b.getCharOffsetStart()))
                .map(slw -> {
                    Word w = slw.getWord();
                    List<String> meanings = meaningsByWordId.getOrDefault(w.getId(), List.of()).stream()
                            .map(WordMeaning::getMeaningText)
                            .toList();
                    return new LyricWordSpan(
                            w.getId(), w.getLemma(), w.getLang(), w.getReading(), meanings,
                            slw.getCharOffsetStart(), slw.getCharOffsetEnd()
                    );
                })
                .toList();

        Song song = line.getSong();
        return new LyricLineResponse(
                line.getId(), song.getId(), song.getTitle(), song.getArtist(),
                line.getOriginalText(), line.getTranslationNatural(), words
        );
    }
}
