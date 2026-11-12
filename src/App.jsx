import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, FileSpreadsheet, MessageSquare, Send, CheckCircle2, RotateCcw, ArrowRight, ArrowLeft, ShieldCheck, Lock, ExternalLink, MessageCircle, Globe, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

// 🔑 TUS CREDENCIALES DE SUPABASE
const SUPABASE_URL = "https://zbqgwwkhxjxfmzmltglm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_G_Vvo4v1DFXFJy-ojrCLZA_rCbLPSeP";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  // Candado de licencia amarrado al número que inició sesión
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('celsender_auth') === 'true';
  });
  
  const [loggedPhone, setLoggedPhone] = useState(() => {
    return localStorage.getItem('celsender_logged_phone') || '';
  });

  const [inputPhoneCheck, setInputPhoneCheck] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(() => {
    return Number(localStorage.getItem('celsender_step')) || 1;
  });
  
  // Selector de Código de País dinámico
  const [countryCode, setCountryCode] = useState(() => {
    return localStorage.getItem('celsender_country') || '593';
  });
  
  const [excelData, setExcelData] = useState(() => {
    const saved = localStorage.getItem('celsender_excel');
    return saved ? JSON.parse(saved) : [];
  });

  // Lista dinámica de las columnas detectadas en el Excel
  const [excelColumns, setExcelColumns] = useState(() => {
    const saved = localStorage.getItem('celsender_columns');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [fileName, setFileName] = useState(() => {
    return localStorage.getItem('celsender_filename') || '';
  });

  const [messageTemplate, setMessageTemplate] = useState(() => {
    return localStorage.getItem('celsender_template') || '';
  });

  const [sentStatuses, setSentStatuses] = useState(() => {
    const saved = localStorage.getItem('celsender_progress');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('celsender_step', currentStep);
  }, [currentStep]);

  useEffect(() => {
    localStorage.setItem('celsender_template', messageTemplate);
  }, [messageTemplate]);

  useEffect(() => {
    localStorage.setItem('celsender_country', countryCode);
  }, [countryCode]);

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

      // Guardamos la sesión y amarramos el número exacto
      setIsAuthenticated(true);
      setLoggedPhone(cleanInput);
      localStorage.setItem('celsender_auth', 'true');
      localStorage.setItem('celsender_logged_phone', cleanInput);
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
    localStorage.setItem('celsender_filename', file.name);

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

        // Extraer dinámicamente TODAS las columnas del Excel real
        const firstRow = jsonRows[0];
        const detectedColumns = Object.keys(firstRow).map(col => col.trim());
        setExcelColumns(detectedColumns);
        localStorage.setItem('celsender_columns', JSON.stringify(detectedColumns));

        // Mapear filas conservando TODA la información de sus columnas
        const formattedData = jsonRows.map((row, index) => {
          const normalizedRow = { id: index };
          Object.keys(row).forEach((key) => {
            const cleanKey = key.trim();
            normalizedRow[cleanKey] = String(row[key]).trim();
          });
          return normalizedRow;
        }).filter(row => {
          // Buscar una columna que parezca teléfono (contenga tel, cel, phone, movil o números)
          const phoneKey = Object.keys(row).find(k => /tel|cel|phone|movil|whatsapp/i.test(k)) || Object.keys(row)[1];
          return row[phoneKey] && row[phoneKey] !== '';
        });

        if (formattedData.length > 0) {
          setExcelData(formattedData);
          localStorage.setItem('celsender_excel', JSON.stringify(formattedData));
          setSentStatuses({});
          localStorage.removeItem('celsender_progress');
          alert(`¡Excel cargado! Se detectaron ${detectedColumns.length} columnas y ${formattedData.length} contactos.`);
        } else {
          alert('No se pudo identificar una columna de teléfono válida en el Excel.');
        }
      } catch (error) {
        console.error(error);
        alert('Hubo un error al leer el archivo Excel.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Insertar cualquier columna dinámica como variable (ej: {Deuda}, {Puntos}, etc.)
  const insertVariable = (colName) => {
    setMessageTemplate((prev) => prev + ` {${colName}}`);
  };

  const getProcessedMessage = (client) => {
    let msg = messageTemplate;
    // Reemplazar dinámicamente cualquier llave {Columna} con el valor real de esa fila
    Object.keys(client).forEach((key) => {
      const regex = new RegExp(`{${key}}`, 'gi');
      msg = msg.replace(regex, client[key] || '');
    });
    return msg;
  };

  const handleOpenChat = (client) => {
    // Buscar dinámicamente qué columna es la del teléfono
    const phoneKey = Object.keys(client).find(k => /tel|cel|phone|movil|whatsapp/i.test(k)) || Object.keys(client)[1];
    let rawPhone = String(client[phoneKey] || '').replace(/\D/g, '');

    if (rawPhone.startsWith('0') && rawPhone.length >= 9) {
      rawPhone = rawPhone.substring(1);
    }
    
    const cleanNumber = countryCode + rawPhone;
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
      <div style={{ maxWidth: '480px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px', boxSizing: 'border-box', position: 'relative', gap: '20px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '16px', backgroundColor: '#f9f0c3', borderRadius: '50%', border: '1px solid #ebd1a6', color: '#5b9ea6' }}>
            <Lock size={32} />
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#555', padding: '0 10px', lineHeight: '1.4' }}>
            Ingresa tu número celular autorizado. Este número quedará amarrado a tu sesión activa.
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#5b9ea6', marginBottom: '6px' }}>
              Número de Celular Autorizado:
            </label>
            <input
              type="text"
              placeholder="Ej: 593912345678"
              value={inputPhoneCheck}
              onChange={(e) => setInputPhoneCheck(e.target.value)}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '15px', outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loadingLogin}
            style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <ShieldCheck size={18} />
            <span>{loadingLogin ? 'Validando...' : 'Ingresar al Sistema'}</span>
          </button>
        </form>

        <footer style={{ backgroundColor: '#ffffff', border: '1px solid #93c4c8', padding: '12px', textAlign: 'center', fontSize: '12px', color: '#555', borderRadius: '10px', marginTop: '10px' }}>
          <p style={{ margin: 0 }}>© 2026 CelSender • Desarrollado por <span style={{ color: '#5b9ea6', fontWeight: 'bold' }}>celiadigitalec</span></p>
        </footer>

        <a 
          href="https://wa.me/593999999999?text=Hola%20Celia,%20tengo%20una%20duda%20sobre%20CelSender" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#25D366', color: '#fff', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, textDecoration: 'none' }}
        >
          <MessageCircle size={28} />
        </a>
      </div>
    );
  }

  const totalContacts = excelData.length;
  const sentCount = Object.keys(sentStatuses).length;
  const progressPercent = totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0;

  const sampleClient = excelData[0] || {};
  const previewMessage = getProcessedMessage(sampleClient);

  return (
    <div style={{ maxWidth: '480px', margin: 'auto', minHeight: '100vh', backgroundColor: '#faf8f5', color: '#2c3e40', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', position: 'relative', padding: '12px' }}>
      
      <div>
        {/* Header con advertencia de cuenta amarrada */}
        <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #93c4c8', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px', marginBottom: '10px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: '#5b9ea6' }}>CelSender Web</h1>
            <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>Licencia: +{loggedPhone} 🟢</p>
          </div>
          <button
            onClick={() => { setIsAuthenticated(false); localStorage.clear(); }}
            style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '6px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cerrar 🔒
          </button>
        </header>

        {/* Stepper */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #93c4c8', display: 'flex', justifyContent: 'space-around', fontSize: '12px', fontWeight: 'bold' }}>
            <span style={{ color: currentStep === 1 ? '#5b9ea6' : '#999' }}>1. Excel & País</span>
            <span style={{ color: '#ccc' }}>→</span>
            <span style={{ color: currentStep === 2 ? '#5b9ea6' : '#999' }}>2. Mensaje</span>
            <span style={{ color: '#ccc' }}>→</span>
            <span style={{ color: currentStep === 3 ? '#5b9ea6' : '#999' }}>3. Semáforo</span>
          </div>
        </div>

        {/* Contenido Dinámico */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
          
          {/* PASO 1: CARGAR EXCEL Y SELECCIONAR PAÍS */}
          {currentStep === 1 && (
            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={18} style={{ color: '#5b9ea6' }} />
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#5b9ea6' }}>Base de Datos y País</h2>
              </div>

              {/* Selector de Código de País */}
              <div style={{ backgroundColor: '#faf8f5', padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold', color: '#5b9ea6' }}>
                  <Globe size={16} />
                  <span>Código de País:</span>
                </div>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #93c4c8', backgroundColor: '#ffffff', fontSize: '12px', fontWeight: 'bold', color: '#2c3e40', outline: 'none' }}
                >
                  <option value="593">🇪🇨 Ecuador (+593)</option>
                  <option value="57">🇨🇴 Colombia (+57)</option>
                  <option value="51">🇵🇪 Perú (+51)</option>
                  <option value="34">🇪🇸 España (+34)</option>
                  <option value="52">🇲🇽 México (+52)</option>
                  <option value="1">🇺🇸 Estados Unidos (+1)</option>
                </select>
              </div>

              <div style={{ border: '2px dashed #93c4c8', borderRadius: '8px', padding: '16px', textAlign: 'center', backgroundColor: '#faf8f5' }}>
                <Upload size={24} style={{ color: '#5b9ea6', margin: '0 auto 6px auto', display: 'block' }} />
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#444', fontWeight: '500' }}>
                  {fileName ? `Excel: ${fileName}` : `Cargados: ${excelData.length} contactos`}
                </p>
                <label style={{ display: 'inline-block', backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '11px', fontWeight: 'bold', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #ebd1a6' }}>
                  <span>Subir archivo .xlsx (Cualquier columna)</span>
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                    onChange={handleExcelUpload} 
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>

              {excelColumns.length > 0 && (
                <div style={{ fontSize: '10px', color: '#166534', backgroundColor: '#f0fdf4', padding: '6px', borderRadius: '6px', border: '1px solid #86efac' }}>
                  ✅ Columnas detectadas: {excelColumns.join(', ')}
                </div>
              )}

              <button
                onClick={() => {
                  if (excelData.length === 0) { alert('Sube un archivo Excel primero.'); return; }
                  setCurrentStep(2);
                }}
                style={{ width: '100%', backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Continuar a Redactar</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* PASO 2: REDACTAR MENSAJE CON COLUMNAS DINÁMICAS */}
          {currentStep === 2 && (
            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={18} style={{ color: '#5b9ea6' }} />
                <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#5b9ea6' }}>Plantilla con tus Columnas</h2>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '4px' }}>Toca para insertar tus columnas del Excel:</span>
                {excelColumns.length === 0 ? (
                  <p style={{ fontSize: '11px', color: '#e06d6d' }}>Sube un Excel en el Paso 1 para ver tus columnas.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '80px', overflowY: 'auto' }}>
                    {excelColumns.map((col) => (
                      <button
                        key={col}
                        onClick={() => insertVariable(col)}
                        style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', fontSize: '10px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', border: '1px solid #ebd1a6', cursor: 'pointer' }}
                      >
                        +{col}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#5b9ea6', display: 'block', marginBottom: '4px' }}>Redacta tu mensaje:</span>
                <textarea
                  rows="4"
                  placeholder="Ej: Hola {Nombre}, tienes una deuda de {Deuda} y {Puntos} acumulados..."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #93c4c8', backgroundColor: '#faf8f5', fontSize: '12px', outline: 'none', color: '#2c3e40', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '8px', border: '1px solid #86efac' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '3px' }}>
                  👁️ Vista previa:
                </span>
                <p style={{ margin: 0, fontSize: '11px', color: '#14532d', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {previewMessage || <span style={{ color: '#888', fontStyle: 'italic' }}>Escribe algo arriba...</span>}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCurrentStep(1)}
                  style={{ backgroundColor: '#f9f0c3', color: '#2c3e40', border: '1px solid #ebd1a6', padding: '9px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
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
                  style={{ flex: 1, backgroundColor: '#5b9ea6', color: '#ffffff', border: 'none', padding: '9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>Ir a Envíos</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: CONTROL DE ENVÍOS SEMÁFORO */}
          {currentStep === 3 && (
            <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #93c4c8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Send size={18} style={{ color: '#5b9ea6' }} />
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#5b9ea6' }}>Cola de Envíos (Semáforo)</h2>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ backgroundColor: '#f9f0c3', color: '#5b9ea6', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '6px', border: '1px solid #ebd1a6' }}>
                    {sentCount} / {totalContacts} ({progressPercent}%)
                  </span>
                  <button onClick={resetProgress} title="Reiniciar progreso" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e06d6d', padding: 0 }}>
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>

              {excelData.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', padding: '16px 0' }}>No hay contactos cargados. Vuelve al Paso 1.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                  {excelData.map((client) => {
                    const isSent = sentStatuses[client.id] === true;
                    const clientMessage = getProcessedMessage(client);
                    const nameKey = Object.keys(client).find(k => /nombre|name|cliente/i.test(k)) || Object.keys(client)[0];
                    const displayName = client[nameKey] || `Cliente ${client.id + 1}`;

                    return (
                      <div 
                        key={client.id} 
                        style={{ 
                          backgroundColor: isSent ? '#f0fdf4' : '#faf8f5', 
                          padding: '9px 12px', 
                          borderRadius: '8px', 
                          border: `1px solid ${isSent ? '#86efac' : '#93c4c8'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c3e40', marginBottom: '2px' }}>
                            👤 {displayName} {isSent && '✅'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>
                            "{clientMessage || 'Sin mensaje'}"
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
                            fontSize: '11px',
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
                style={{ width: '100%', backgroundColor: '#faf8f5', color: '#5b9ea6', border: '1px solid #93c4c8', padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ← Volver al Redactor
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Footer Visible y Elegante */}
      <footer style={{ backgroundColor: '#ffffff', border: '1px solid #93c4c8', padding: '10px 14px', textAlign: 'center', fontSize: '11px', color: '#555', borderRadius: '8px', marginTop: '10px' }}>
        <p style={{ margin: 0 }}>© 2026 CelSender • Desarrollado por <span style={{ color: '#5b9ea6', fontWeight: 'bold' }}>celiadigitalec</span></p>
      </footer>

      {/* Botón Flotante de WhatsApp */}
      <a 
        href="https://wa.me/593939669413?text=Hola%20Celia,%20tengo%20una%20duda%20sobre%20CelSender" 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#25D366', color: '#fff', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1000, textDecoration: 'none' }}
        title="¿Dudas o sugerencias? Contáctame"
      >
        <MessageCircle size={26} />
      </a>
    </div>
  );
}