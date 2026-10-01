package com.utago.wordbook;

import com.utago.common.Lang;

import java.util.List;

/**
 * 단어장 화면 "단어 추가" — 가사에 없는 단어를 직접 입력해서 담는다.
 *
 * lemma만 필수. reading/meanings는 프론트에서 자동 조회(GET .../items/lookup)로 미리 채워주지만
 * 사용자가 그 값을 확인하고 고쳐서 보낼 수 있다 — 최종적으로 서버는 이 요청에 담긴 값을
 * 그대로(AI로 다시 만들지 않고) 저장한다. 둘 다 비어있고 서버가 사전(JMdict)에서도 못 찾으면
 * 에러를 던진다(그 경우 프론트가 "직접 입력해주세요" 안내를 보여줘야 함).
 *
 * lang을 생략하면 일본어(JA)로 본다. wordbookId를 생략하면 기본(즐겨찾기) 단어장에 담긴다.
 */
public record AddCustomWordRequest(
        String lemma,
        Lang lang,
        Long wordbookId,
        String reading,
        List<String> meanings
) {}
