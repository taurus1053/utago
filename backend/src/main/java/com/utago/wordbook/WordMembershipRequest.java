package com.utago.wordbook;

import com.utago.common.Lang;

import java.util.List;

/** 곡 학습 화면에서 현재 소절의 단어들이 이미 어느 단어장(들)에 담겨 있는지 한 번에 물어볼 때 쓴다. */
public record WordMembershipRequest(List<String> lemmas, Lang lang) {}
