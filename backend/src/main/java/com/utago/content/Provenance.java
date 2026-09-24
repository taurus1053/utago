package com.utago.content;

/**
 * 콘텐츠(가사 원문) 확보 경로. 향후 라이선스 콘텐츠로 전환할 때
 * 어떤 곡을 우선 교체해야 하는지 판단하는 근거가 된다.
 */
public enum Provenance {
    SELF_TYPED,
    AI_GENERATED,
    LICENSED
}
