import { useEffect, useState } from 'react'

// 유튜브 IFrame Player API(<script src="https://www.youtube.com/iframe_api">) 로드 상태를
// 알려주는 공용 훅. 여러 화면(SongLearn의 "자동 싱크", SongSync의 탭싱크)이 각자 플레이어를
// 만들기 전에 이 훅으로 API 준비 여부를 확인한다 — 스크립트 태그는 페이지에 한 번만 추가된다.
export default function useYoutubeApiReady() {
  const [ready, setReady] = useState(Boolean(window.YT && window.YT.Player))

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setReady(true)
      return
    }
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
    const prevCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback()
      setReady(true)
    }
  }, [])

  return ready
}
