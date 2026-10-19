import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './Credits.css'

// 오픈 데이터/라이브러리 출처 표기(크레딧) 화면. 로그인 없이 누구나 볼 수 있다.
// JMdict는 CC BY-SA 3.0 이라 출처 표기가 라이선스 의무다.
export default function Credits() {
  const { t } = useTranslation('credits')
  return (
    <div className="credits-page">
      <div className="credits-inner">
        <Link to="/" className="credits-back">{t('back')}</Link>
        <h1 className="credits-title">{t('title')}</h1>
        <p className="credits-lead">
          {t('lead')}
        </p>

        <section className="credits-section">
          <h2>{t('jmdictTitle')}</h2>
          <p>
            {t('jmdictDesc')}
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
          <h2>{t('kuromojiTitle')}</h2>
          <p>
            {t('kuromojiDesc')}
          </p>
        </section>

        <section className="credits-section">
          <h2>{t('audioTitle')}</h2>
          <p>
            {t('audioDesc')} YouTube is a trademark of Google LLC.
          </p>
        </section>
      </div>
    </div>
  )
}
