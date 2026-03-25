import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso Legal — peru-financia",
  description: "Aviso legal, fuentes de datos y política de tratamiento de datos personales.",
};

export default function LegalPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[#1f1f1f] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-[#888] hover:text-foreground transition-colors text-sm">
            ← peru-financia
          </Link>
          <span className="text-[#333]">/</span>
          <span className="text-sm text-[#888]">aviso legal</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">Aviso Legal</h1>
          <p className="text-[#888] text-sm">Última actualización: marzo 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">1. Fuente de datos</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            Toda la información presentada en esta plataforma proviene de fuentes públicas oficiales,
            principalmente los informes financieros publicados por la Oficina Nacional de Procesos
            Electorales (ONPE) y el Jurado Nacional de Elecciones (JNE), conforme a la Ley 28094
            (Ley de Organizaciones Políticas) y la Ley 31046 (reforma 2020).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">2. Propósito</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            Esta plataforma tiene como finalidad promover la transparencia y la participación
            ciudadana en el proceso democrático, en concordancia con la Ley 27806 (Ley de
            Transparencia y Acceso a la Información Pública) y el artículo 2 de la Constitución
            Política del Perú. Es un proyecto open-source sin fines de lucro.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">3. Datos personales</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            El tratamiento de datos personales contenidos en esta plataforma se ampara en el
            artículo 14, inciso 2 de la Ley 29733 (Ley de Protección de Datos Personales), al
            tratarse de datos contenidos en fuentes accesibles al público. Se publican exclusivamente:
          </p>
          <ul className="text-[#888] text-sm leading-relaxed list-disc pl-6 space-y-1">
            <li>Nombre del donante (persona natural o jurídica)</li>
            <li>Monto de la donación</li>
            <li>Fecha de la donación</li>
            <li>Organización política receptora</li>
            <li>Tipo de donación (efectivo, especie, bancarizado)</li>
          </ul>
          <p className="text-[#888] text-sm leading-relaxed">
            No se publican documentos de identidad (DNI), direcciones, números de teléfono,
            correos electrónicos ni ningún otro dato que exceda lo estrictamente necesario para
            la transparencia del financiamiento político.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">4. Sin garantía</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            La información se presenta tal cual fue publicada por las entidades oficiales. No
            garantizamos la exactitud, completitud o actualidad de los datos. Errores en las
            fuentes originales pueden reflejarse en esta plataforma.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">5. Uso responsable</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            Los usuarios se comprometen a utilizar la información con fines legítimos de
            investigación, periodismo o participación ciudadana. Queda prohibido el uso de
            los datos para acoso, discriminación o cualquier actividad ilícita.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">6. Derecho de rectificación</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            Si identifica información incorrecta sobre su persona, puede solicitar su
            rectificación contactando a{" "}
            <a href="mailto:legal@crafterstation.com" className="text-[#c084fc] hover:underline">
              legal@crafterstation.com
            </a>
            . Verificaremos contra la fuente oficial y corregiremos de ser necesario.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">7. Licencia</h2>
          <p className="text-[#888] text-sm leading-relaxed">
            El código fuente de esta plataforma está disponible bajo la licencia{" "}
            <a
              href="https://github.com/crafter-research/peru-financia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c084fc] hover:underline"
            >
              AGPL-3.0
            </a>
            . Cualquier institución que utilice este código debe contribuir sus modificaciones
            de vuelta a la comunidad.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">8. Marco legal aplicable</h2>
          <div className="border border-[#1f1f1f] rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#111]">
                  <th className="text-left px-4 py-3 text-[#888] font-normal">Ley</th>
                  <th className="text-left px-4 py-3 text-[#888] font-normal">Artículo</th>
                  <th className="text-left px-4 py-3 text-[#888] font-normal">Relevancia</th>
                </tr>
              </thead>
              <tbody className="text-[#888]">
                {[
                  ["Ley 29733", "Art. 14.2", "Datos de fuentes públicas no requieren consentimiento"],
                  ["Ley 27806", "Art. 1, 3", "Presunción de publicidad de información estatal"],
                  ["Ley 28094", "Art. 34.3", "Identificación obligatoria de donantes en informes"],
                  ["Ley 31046", "Art. 34.5, 34.8", "Publicación obligatoria, Portal Digital"],
                  ["Constitución", "Art. 2.5", "Derecho a solicitar información pública"],
                ].map(([ley, art, rel]) => (
                  <tr key={`${ley}-${art}`} className="border-b border-[#111]">
                    <td className="px-4 py-2.5 font-mono text-xs">{ley}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{art}</td>
                    <td className="px-4 py-2.5 text-xs">{rel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
