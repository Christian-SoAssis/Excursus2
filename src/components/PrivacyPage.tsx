import { ExcursusLogo } from './ExcursusLogo'

export function PrivacyPage() {
  return (
    <div className="prv-page">
      <header className="prv-header">
        <a href="/" className="prv-header__back">
          <ExcursusLogo size={22} bg />
          <span>Excursus</span>
        </a>
      </header>

      <main className="prv-body">
        <div className="prv-container">

          <h1 className="prv-title">Política de Privacidade</h1>
          <p className="prv-updated">Última atualização: 25 de maio de 2026</p>

          {/* ── 1 ── */}
          <section className="prv-section">
            <h2>1. Quem somos</h2>
            <p>
              O Excursus é um produto da <strong>ChriSingularis</strong>. Neste documento,
              "nós", "nosso" e "Excursus" referem-se à ChriSingularis como responsável
              pelo tratamento dos seus dados pessoais.
            </p>
          </section>

          {/* ── 2 ── */}
          <section className="prv-section">
            <h2>2. Dados que coletamos</h2>
            <table className="prv-table">
              <thead>
                <tr>
                  <th>Dado</th>
                  <th>Origem</th>
                  <th>Finalidade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>E-mail e senha</td>
                  <td>Cadastro / login</td>
                  <td>Autenticação via Supabase Auth</td>
                </tr>
                <tr>
                  <td>Nome de exibição e foto de perfil</td>
                  <td>Configurações de conta</td>
                  <td>Personalização da interface</td>
                </tr>
                <tr>
                  <td>Conteúdo das notas (título, texto, pasta, posição)</td>
                  <td>Editor</td>
                  <td>Armazenamento e sincronização do seu espaço</td>
                </tr>
                <tr>
                  <td>Eventos de calendário</td>
                  <td>Integração Google Calendar</td>
                  <td>Exibição e criação de eventos no modo Calendário</td>
                </tr>
                <tr>
                  <td>Conteúdo enviado à IA</td>
                  <td>Modo AI</td>
                  <td>Geração de respostas pelo Google Gemini</td>
                </tr>
                <tr>
                  <td>Cache local de notas</td>
                  <td>localStorage do navegador</td>
                  <td>Acesso offline e carregamento rápido</td>
                </tr>
                <tr>
                  <td>Logs de acesso</td>
                  <td>Infraestrutura Supabase</td>
                  <td>Segurança e diagnóstico de erros</td>
                </tr>
              </tbody>
            </table>
            <p className="prv-note">
              Não coletamos dados de rastreamento, cookies de terceiros para publicidade,
              nem vendemos dados a ninguém.
            </p>
          </section>

          {/* ── 3 ── */}
          <section className="prv-section">
            <h2>3. Como usamos seus dados</h2>
            <ul>
              <li>
                <strong>Prestar o serviço:</strong> armazenar e sincronizar suas notas entre
                dispositivos.
              </li>
              <li>
                <strong>Personalização:</strong> exibir seu nome e foto no app.
              </li>
              <li>
                <strong>Funcionalidades avançadas:</strong> o conteúdo das suas notas é
                usado para cálculo de similaridade entre notas (pg_trgm no Supabase) e pode
                ser enviado à API do Google Gemini quando você usa o modo AI.
              </li>
              <li>
                <strong>Segurança:</strong> logs de acesso são mantidos pela infraestrutura
                Supabase para detecção de abusos.
              </li>
            </ul>
          </section>

          {/* ── 4 ── */}
          <section className="prv-section">
            <h2>4. Compartilhamento com terceiros</h2>
            <p>Usamos os seguintes serviços externos:</p>
            <table className="prv-table">
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th>Finalidade</th>
                  <th>Política de privacidade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Supabase</strong> (EUA)</td>
                  <td>Banco de dados, autenticação e armazenamento de arquivos</td>
                  <td>
                    <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
                      supabase.com/privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td><strong>Google Gemini API</strong></td>
                  <td>Geração de texto por IA, apenas quando você usa o modo AI</td>
                  <td>
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                      policies.google.com/privacy
                    </a>
                  </td>
                </tr>
                <tr>
                  <td><strong>Google Calendar API</strong></td>
                  <td>Leitura e criação de eventos, apenas se você autorizar a integração</td>
                  <td>
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                      policies.google.com/privacy
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="prv-note">Nenhum outro terceiro tem acesso aos seus dados.</p>
          </section>

          {/* ── 5 ── */}
          <section className="prv-section">
            <h2>5. Armazenamento e segurança</h2>
            <ul>
              <li>Dados são armazenados em servidores da Supabase.</li>
              <li>Toda comunicação usa HTTPS/TLS.</li>
              <li>Senhas nunca são armazenadas em texto claro — a Supabase usa bcrypt.</li>
              <li>
                Fotos de perfil são armazenadas no bucket privado <code>avatars</code> da
                Supabase Storage.
              </li>
              <li>
                O cache offline fica exclusivamente no <code>localStorage</code> do seu
                navegador, no seu dispositivo.
              </li>
            </ul>
          </section>

          {/* ── 6 ── */}
          <section className="prv-section">
            <h2>6. Seus direitos (LGPD — Lei nº 13.709/2018)</h2>
            <p>
              Conforme a Lei Geral de Proteção de Dados brasileira, você tem direito a:
            </p>
            <ul>
              <li>
                <strong>Acesso:</strong> solicitar uma cópia dos dados que guardamos sobre
                você.
              </li>
              <li>
                <strong>Correção:</strong> atualizar nome, foto e e-mail nas configurações
                do app.
              </li>
              <li>
                <strong>Exclusão:</strong> solicitar a remoção permanente de todos os seus
                dados através do botão "Excluir conta" nas Configurações — isso apaga sua
                conta, notas e arquivos.
              </li>
              <li>
                <strong>Portabilidade:</strong> solicitar seus dados em formato estruturado
                entrando em contato conosco.
              </li>
              <li>
                <strong>Revogação de consentimento:</strong> desconectar a integração com o
                Google Calendar a qualquer momento nas Configurações.
              </li>
              <li>
                <strong>Reclamação:</strong> registrar queixa junto à{' '}
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer">
                  ANPD
                </a>{' '}
                (Autoridade Nacional de Proteção de Dados).
              </li>
            </ul>
          </section>

          {/* ── 7 ── */}
          <section className="prv-section">
            <h2>7. Retenção de dados</h2>
            <ul>
              <li>Dados de conta e notas são mantidos enquanto sua conta estiver ativa.</li>
              <li>
                Ao excluir a conta, todos os dados são removidos permanentemente em até{' '}
                <strong>30 dias</strong>.
              </li>
              <li>
                Logs de infraestrutura da Supabase seguem a política de retenção própria da
                Supabase (geralmente 90 dias).
              </li>
            </ul>
          </section>

          {/* ── 8 ── */}
          <section className="prv-section">
            <h2>8. Menores de idade</h2>
            <p>
              O Excursus não é direcionado a menores de 13 anos e não coletamos
              intencionalmente dados de crianças.
            </p>
          </section>

          {/* ── 9 ── */}
          <section className="prv-section">
            <h2>9. Alterações nesta política</h2>
            <p>
              Quando fizermos mudanças relevantes, notificaremos por e-mail ou por aviso no
              app. A data de "última atualização" no topo sempre refletirá a versão atual.
            </p>
          </section>

          {/* ── 10 ── */}
          <section className="prv-section">
            <h2>10. Contato</h2>
            <p>Para exercer seus direitos ou tirar dúvidas:</p>
            <p>
              📧{' '}
              <a href="mailto:assis.christiansales@gmail.com">
                assis.christiansales@gmail.com
              </a>
            </p>
            <p className="prv-note">Excursus · ChriSingularis</p>
          </section>

        </div>
      </main>

      <footer className="prv-footer">
        <div className="prv-container">
          <p>© {new Date().getFullYear()} Excursus · ChriSingularis · Todos os direitos reservados.</p>
          <a href="/">← Voltar ao início</a>
        </div>
      </footer>
    </div>
  )
}
