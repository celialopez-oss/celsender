import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, FileSpreadsheet, MessageSquare, Send, CheckCircle2, RotateCcw, ArrowRight, ArrowLeft, ShieldCheck, Lock, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';

// 🔑 TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://zbqgwwkhxjxfmzmltglm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G_Vvo4v1DFXFJy-ojrCLZA_rCbLPSeP";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPhoneCheck, setInputPhoneCheck] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [countryCode, setCountryCode] = useState('593');
  
  const [excelData, setExcelData] = useState([]);
  const [fileName, setFileName] = useState('');

  // Mensaje por defecto en blanco con placeholder
  const [messageTemplate, setMessageTemplate] = useState('');

  // Estado para llevar el control de qué contactos ya fueron enviados (semáforo)
  const [sentStatuses, setSentStatuses] = useState({});

  // Mantener sesión activa si ya validó antes
  useEffect(() => {
    const savedAuth = localStorage.getItem('celsender_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    const savedProgress = localStorage.getItem('celsender_progress');
    if (savedProgress) {
      try { setSentStatuses(JSON.parse(savedProgress)); } catch(e){}
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanInput = inputPhoneCheck.trim().replace(/^0/, '');
    if (!cleanInput) return;

    setLoadingLogin(true);

    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .select('*')
        .eq('phone', cleanInput)
        .single();

      if (error || !data) {
        alert('⚠️ Este número no está autorizado o no se encuentra registrado en el sistema.');
        setLoadingLogin(false);
        return;
      }

      if (data.expiry_date) {
        const expiry = new Date(data.expiry_date);
        const now = new Date();
        if (expiry < now) {
          alert('❌ Tu licencia mensual ha caducado. Comunícate con la administración para renovarla.');
          setLoadingLogin(false);
          return;
        }
      }

      setIsAuthenticated(true);
      localStorage.setItem('celsender_auth', 'true');
    } catch (err) {
      console.error(err);
      alert('Error de conexión al validar el número.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonRows.length === 0) {
          alert('El archivo de Excel está vacío.');
          return;
        }

        const formattedData = jsonRows.map((row, index) => {
          const normalizedRow = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[key.trim().toLowerCase()] = String(row[key]).trim();
          });

          return {
            id: index,
            nombre: normalizedRow['nombre'] || normalizedRow['name'] || normalizedRow['cliente'] || `Clienta ${index + 1}`,
            telefono: normalizedRow['telefono'] || normalizedRow['celular'] || normalizedRow['phone'] || '',
            deuda: normalizedRow['deuda'] || normalizedRow['saldo'] || normalizedRow['monto'] || '$0.00',
            nivel: normalizedRow['nivel'] || normalizedRow['categoria'] || 'General'
          };
        }).filter(client => client.telefono !== '');

        if (formattedData.length > 0) {
          setExcelData(formattedData);
          setSentStatuses({});
          localStorage.removeItem('celsender_progress');
          alert(`¡Se cargaron exitosamente ${formattedData.length} contactos!`);
        } else {
          alert('No se encontraron teléfonos válidos en el Excel.');
        }
      } catch (error) {
        console.error(error);
        alert('Hubo un error al leer el archivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const insertVariable = (variable) => {
    setMessageTemplate((prev) => prev + ` {${variable}}`);
  };

  const getProcessedMessage = (client) => {
    let msg = messageTemplate;
    msg = msg.replace(/{nombre}/g, client.nombre || '');
    msg = msg.replace(/{telefono}/g, client.telefono || '');
    msg = msg.replace(/{deuda}/g, client.deuda || '');
    msg = msg.replace(/{nivel}/g, client.nivel || '');
    return msg;
  };

  // Función para disparar el chat de WhatsApp y marcar como enviado
  const handleOpenChat = (client) => {
    let cleanNumber = client.telefono.replace(/\D/g, '');
    if (cleanNumber.startsWith('0') && cleanNumber.length === 10) {
      cleanNumber = countryCode + cleanNumber.substring(1);
    } else if (cleanNumber.length === 9 && !cleanNumber.startsWith(countryCode)) {
      cleanNumber = countryCode + cleanNumber;
    }

    const finalMsg = getProcessedMessage(client);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(finalMsg)}`;

    window.open(whatsappUrl, '_blank');

    const updatedStatuses = { ...sentStatuses, [client.id]: true };
    setSentStatuses(updatedStatuses);
    localStorage.setItem('celsender_progress', JSON.stringify(updatedStatuses));
  };

  const resetProgress = () => {
    if (window.confirm('¿Deseas reiniciar el progreso de todos los envíos?')) {
      setSentStatuses({});
      localStorage.removeItem('celsender_progress');
    }
  };

  // PANTALLA DE ACCESO
  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '420px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '16px', backgroundColor: '#f9f0c3', borderRadius: '50%', border: '1px solid #ebd1a6', color: '#5b9ea6' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#666', padding: '0 10px' }}>
            Ingresa tu número celular autorizado para acceder a tu panel de envíos.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6', marginBottom: '6px' }}>
              Número de Celular:
            </label>
            <input
              type="text"
              placeholder="Ej: 593991112223"
              value={inputPhoneCheck}
              onChange={(e) => setInputPhoneCheck(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loadingLogin}
            style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <ShieldCheck size={18} />
            <span>{loadingLogin ? 'Validando...' : 'Ingresar al Sistema'}</span>
          </button>
        </form>

        <footer style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}>
          <p style={{ margin: 0 }}>© 2026 CelSender • <span style={{ color: '#5b9ea6', fontWeight: '500' }}>celiadigitalec</span></p>
        </footer>
      </div>
    );
  }

  // PANEL PRINCIPAL WEB / MÓVIL
  const totalContacts = excelData.length;
  const sentCount = Object.keys(sentStatuses).length;
  const progressPercent = totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0;

  // Muestra una vista previa basada en el primer contacto del Excel (si existe)
  const sampleClient = excelData[0] || { nombre: 'María', telefono: '0999999999', deuda: '$45.00', nivel: 'VIP' };
  const previewMessage = getProcessedMessage(sampleClient);

  return (
    <div style={{ maxWidth: '480px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      
      {/* Header */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #93c4c8', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h1>
          <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>Licencia Activa 🟢</p>
        </div>
        <button
          onClick={() => { setIsAuthenticated(false); localStorage.removeItem('celsender_auth'); }}
          style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Cerrar 🔒
        </button>
      </header>

      {/* Stepper */}
      <div style={{ padding: '10px 16px 0 16px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #93c4c8', display: 'flex', justifyContent: 'space-around', fontSize: '12px', fontWeight: 'bold' }}>
          <span style={{ color: currentStep === 1 ? '#5b9ea6' : '#999' }}>1. Excel</span>
          <span style={{ color: '#ccc' }}>→</span>
          <span style={{ color: currentStep === 2 ? '#5b9ea6' : '#999' }}>2. Mensaje</span>
          <span style={{ color: '#ccc' }}>→</span>
          <span style={{ color: currentStep === 3 ? '#5b9ea6' : '#999' }}>3. Envío Semáforo</span>
        </div>
      </div>

      {/* Contenido */}
      <main style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* PASO 1: CARGAR EXCEL */}
        {currentStep === 1 && (
          <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={16} style={{ color: '#5b9ea6' }} />
              <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#5b9ea6' }}>Cargar Base de Contactos</h2>
            </div>

            <div style={{ border: '2px dashed #93c4c8', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#faf8f5' }}>
              <Upload size={24} style={{ color: '#5b9ea6', margin: '0 auto 8px auto', display: 'block' }} />
              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#444', fontWeight: '500' }}>
                {fileName ? `Excel: ${fileName}` : `Cargados: ${excelData.length} contactos`}
              </p>
              <label style={{ display: 'inline-block', backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '11px', fontWeight: 'bold', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #ebd1a6' }}>
                <span>Subir archivo .xlsx</span>
                <input type="file" accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleExcelUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <button
              onClick={() => {
                if (excelData.length === 0) { alert('Sube un archivo Excel primero.'); return; }
                setCurrentStep(2);
              }}
              style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}
            >
              <span>Continuar a Redactar</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* PASO 2: REDACTAR MENSAJE (SIN EMOJIS EXTRAS, CON VISTA PREVIA) */}
        {currentStep === 2 && (
          <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={16} style={{ color: '#5b9ea6' }} />
              <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#5b9ea6' }}>Plantilla de Mensaje</h2>
            </div>

            {/* Botones de Variables */}
            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '3px' }}>Variables del Excel:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {['nombre', 'telefono', 'deuda', 'nivel'].map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', border: '1px solid #ebd1a6', cursor: 'pointer' }}
                  >
                    +{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Principal (Soporta emojis nativos del teclado del celular) */}
            <div>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '3px' }}>Redacta tu mensaje:</span>
              <textarea
                rows="5"
                placeholder="Escribe aquí tu mensaje..."
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #93c4c8', backgroundColor: '#faf8f5', fontSize: '11px', outline: 'none', color: '#2c3e40', boxSizing: 'border-box' }}
              />
            </div>

            {/* VISTA PREVIA EN TIEMPO REAL */}
            <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #86efac' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '4px' }}>
                👁️ Vista previa (cómo lo verá tu cliente):
              </span>
              <p style={{ margin: 0, fontSize: '11px', color: '#14532d', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {previewMessage || <span style={{ color: '#888', fontStyle: 'italic' }}>Escribe algo arriba para ver la vista previa...</span>}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} />
                <span>Atrás</span>
              </button>
              <button
                onClick={() => {
                  if (excelData.length === 0) { alert('Sube un Excel primero.'); setCurrentStep(1); return; }
                  if (!messageTemplate.trim()) { alert('Por favor escribe un mensaje antes de continuar.'); return; }
                  setCurrentStep(3);
                }}
                style={{ flex: 1, backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Ir a la Cola de Envíos</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: CONTROL DE ENVÍOS SEMÁFORO */}
        {currentStep === 3 && (
          <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={16} style={{ color: '#5b9ea6' }} />
                <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#5b9ea6' }}>Cola de Envíos (Semáforo)</h2>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ backgroundColor: '#f9f0c3', color: '#5b9ea6', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '8px', border: '1px solid #ebd1a6' }}>
                  {sentCount} / {totalContacts} ({progressPercent}%)
                </span>
                <button onClick={resetProgress} title="Reiniciar progreso" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e06d6d', padding: 0 }}>
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {excelData.length === 0 ? (
              <p style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '20px 0' }}>No hay contactos cargados. Vuelve al Paso 1.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                {excelData.map((client) => {
                  const isSent = sentStatuses[client.id] === true;
                  return (
                    <div 
                      key={client.id} 
                      style={{ 
                        backgroundColor: isSent ? '#f0fdf4' : '#faf8f5', 
                        padding: '8px 10px', 
                        borderRadius: '8px', 
                        border: `1px solid ${isSent ? '#86efac' : '#93c4c8'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#2c3e40', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {client.nombre} {isSent && '✅'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          +{countryCode} {client.telefono} | Saldo: {client.deuda}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenChat(client)}
                        style={{
                          backgroundColor: isSent ? '#10b981' : '#5b9ea6',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <ExternalLink size={12} />
                        <span>{isSent ? 'Reenviar' : 'Enviar'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setCurrentStep(2)}
              style={{ width: '100%', backgroundColor: '#faf8f5', color: '#5b9ea6', border: '1px solid #93c4c8', padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}
            >
              ← Volver al Redactor
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#ffffff', borderTop: '1px solid #93c4c8', padding: '8px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
        <p style={{ margin: 0 }}>© 2026 CelSender • <span style={{ color: '#5b9ea6', fontWeight: '500' }}>celiadigitalec</span></p>
      </footer>
    </div>
  );
}