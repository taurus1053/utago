import { Link } from 'react-router-dom'
import './Credits.css'

// 오픈 데이터/라이브러리 출처 표기(크레딧) 화면. 로그인 없이 누구나 볼 수 있다.
// JMdict는 CC BY-SA 3.0 이라 출처 표기가 라이선스 의무다.
export default function Credits() {
  return (
    <div className="credits-page">
      <div className="credits-inner">
        <Link to="/" className="credits-back">← 돌아가기</Link>
        <h1 className="credits-title">크레딧 · Credits</h1>
        <p className="credits-lead">
          우타고(Utago)는 아래의 오픈 데이터와 오픈소스 소프트웨어의 도움을 받아 만들어졌어요.
        </p>

        <section className="credits-section">
          <h2>JMdict (일본어 사전 데이터)</h2>
          <p>
            단어 뜻 채우기에는 EDRDG(Electronic Dictionary Research and Development Group)의
            JMdict 사전 데이터 중 일부를 사용해요. 이 데이터를 바탕으로 한국어 뜻을 만들었어요.
          </p>
          <p>
            This application uses the JMdict dictionary file. This file is the property of the
            Electronic Dictionary Research and Development Group, and is used in conformance with
            the Group&apos;s licence.
          </p>
          <ul>
            <li>
              <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener noreferrer">
                JMdict Project
              </a>
            </li>
            <li>
              <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noopener noreferrer">
                EDRDG Licence
              </a>
              {' '}(CC BY-SA 3.0)
            </li>
          </ul>
        </section>

        <section className="credits-section">
          <h2>Kuromoji (일본어 형태소 분석)</h2>
          <p>
            가사의 후리가나와 단어 추출에는 오픈소스 형태소 분석기 Kuromoji(Atilika, Apache License 2.0)를
            사용해요.
          </p>
        </section>

        <section className="credits-section">
          <h2>음원 재생</h2>
          <p>
            음원은 YouTube 플레이어를 통해 재생돼요. YouTube is a trademark of Google LLC.
          </p>
        </section>
      </div>
    </div>
  )
}
