import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [fileUploading, setFileUploading] = useState(false)
  const [textUploading, setTextUploading] = useState(false)
  const [mode, setMode] = useState<'get' | 'post'>('post')
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const [uploadError, setUploadError] = useState('')
  const [textUploadError, setTextUploadError] = useState('')
  const [getError, setGetError] = useState('')

  useEffect(() => {
    if (mode === 'get') {
      fetchItems()
    }
  }, [mode])

  async function fetchItems() {
    try {
      setLoadingItems(true)
      setGetError('')
      const res = await fetch('/api/files')
      const data = await res.json()
      
      if (!res.ok || data.success === false) {
        setGetError(data.message || data.error?.message || "Failed to fetch files")
        setItems([])
        return
      }

      let arr = []
      if (Array.isArray(data)) arr = data
      else if (Array.isArray(data?.rows)) arr = data.rows
      else if (Array.isArray(data?.data?.rows)) arr = data.data.rows
      else if (Array.isArray(data?.data)) arr = data.data
      else if (Array.isArray(data?.result?.rows)) arr = data.result.rows
      else if (Array.isArray(data?.result)) arr = data.result
      else if (Array.isArray(data?.files)) arr = data.files
      
      if (Array.isArray(arr) && (arr.length > 0 || (data && typeof data === 'object'))) {
        setItems(arr)
      } else {
        setItems([])
      }
    } catch (e) {
      setGetError("Network error occurred")
    } finally {
      setLoadingItems(false)
    }
  }

  async function handleUpload() {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setFileUploading(true)
    setUploadError('')
    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        setUploadError(json.message || json.error?.message || "File upload failed")
      } else {
        setFile(null)
      }
    } catch (e) {
      setUploadError("Network error occurred")
    } finally {
      setFileUploading(false)
    }
  }

  async function handleTextUpload() {
    if (!text.trim()) return
    setTextUploading(true)
    setTextUploadError('')
    try {
      const res = await fetch('/api/text/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json()
      if (!res.ok || json.success === false) {
        setTextUploadError(json.message || json.error?.message || "Text upload failed")
      } else {
        setText('')
      }
    } catch (e) {
      setTextUploadError("Network error occurred")
    } finally {
      setTextUploading(false)
    }
  }

  async function getDownloadLink(fileName: string) {
    setGetError('')
    try {
      const res = await fetch(`/api/files/download/${encodeURIComponent(fileName)}`);
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setGetError(json.message || json.error?.message || "Failed to fetch link")
        return null;
      }
      
      let rawLink = typeof json.data === 'string' 
          ? json.data 
          : (json.data?.link || json.link || (Array.isArray(json.data) ? json.data[0] : null));
      if (typeof rawLink === 'string' && rawLink) {
        return rawLink.replace(/"/g, '');
      }
      setGetError("No link found in response")
    } catch (e) {
      setGetError("Network error occurred")
    }
    return null;
  }

  async function handleView(item: any) {
    if (item.type === 'text') {
      window.open(`/api/text/${item.id}`, '_blank');
      return;
    }
    const fileName = item.file_name;
    if (!fileName) return;
    try {
      const cleanLink = await getDownloadLink(fileName);
      if (cleanLink) window.open(cleanLink, '_blank');
    } catch (e) {
      console.error("View error", e);
    }
  }

  async function handleCopy(item: any) {
    try {
      const res = await fetch(`/api/text/${item.id}`);
      if (res.ok) {
        const json = await res.json();
        const textContent = json.data;
        
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(textContent);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = textContent;
          textArea.style.position = "absolute";
          textArea.style.left = "-999999px";
          document.body.prepend(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
          } catch (err) {
            console.error('Fallback copy failed', err);
          } finally {
            textArea.remove();
          }
        }
        
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        console.error("Failed to fetch text content for copying");
      }
    } catch (e) {
      console.error("Copy error", e);
    }
  }

  async function handleSave(item: any) {
    try {
      setSavingId(item.id);

      const fileName = item.file_name;
      if (!fileName) return;
      const cleanLink = await getDownloadLink(fileName);
      if (cleanLink) {
        try {
          const fileRes = await fetch(cleanLink);
          if (!fileRes.ok) throw new Error('Network response was not ok');
          const blob = await fileRes.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = fileName || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch (fetchErr) {
          console.warn("Could not download via blob, falling back to new tab", fetchErr);
          window.open(cleanLink, '_blank');
        }
      }
    } catch (e) {
      console.error("Save error", e);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="page">
      <div className="mobile-title">Transmittt</div>
      <div className="top-actions">
        <button 
          className="btn"
          onClick={() => setMode('get')}
          disabled={mode === 'get'}
        >
          Get
        </button>
        <button 
          className="btn"
          onClick={() => setMode('post')}
          disabled={mode === 'post'}
        >
          Post
        </button>
      </div>
      {mode === 'post' && (
        <div className="panels">
          <section className="panel">
          <h2 className="panel-title">Upload File</h2>
          <p className="panel-desc">Select a file from your device to upload.</p>
          <div className="panel-body">
            <input
              type="file"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="file-name">{file.name}</p>}
          </div>
          <div className="panel-footer">
            {uploadError && <p style={{ color: 'red', margin: '0 0 8px 0', fontSize: '13px' }}>{uploadError}</p>}
            <button className="btn" onClick={handleUpload} disabled={!file || fileUploading}>
              {fileUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </section>

        <div className="divider">
          <span className="divider-title">Transmittt</span>
        </div>

        <section className="panel">
          <h2 className="panel-title">Paste Text</h2>
          <p className="panel-desc">Write or paste your text content below.</p>
          <div className="panel-body">
            <textarea
              className="textarea"
              placeholder="Start typing or paste here..."
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={50000}
            />
          </div>
          <div className="panel-footer">
            {textUploadError && <p style={{ color: 'red', margin: '0 0 8px 0', fontSize: '13px' }}>{textUploadError}</p>}
            <button className="btn" onClick={handleTextUpload} disabled={!text.trim() || textUploading}>
              {textUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </section>
        </div>
      )}
      {mode === 'get' && (
        <div className="panels">
          <section className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 className="panel-title" style={{ margin: 0 }}>Retrieve Data</h2>
              <button 
                className="btn"
                onClick={fetchItems}
                disabled={loadingItems}
                style={{ padding: '6px 12px', fontSize: '13px', background: 'transparent', border: '1px solid currentColor', color: 'inherit', borderRadius: '4px' }}
              >
                {loadingItems ? '...' : 'Refresh'}
              </button>
            </div>
            <p className="panel-desc" style={{ marginTop: 0 }}>Here is the data from the server.</p>
            {getError && <p style={{ color: 'red', margin: '4px 0', fontSize: '13px' }}>{getError}</p>}
            <div className="panel-body" style={{ overflowY: 'auto', maxHeight: '500px' }}>
              {loadingItems ? (
                <p>Loading...</p>
              ) : !Array.isArray(items) || items.length === 0 ? (
                <p>No items found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {items.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #eee' }}>
                      <div>
                        <span 
                          onClick={() => handleView(item)}
                          style={{ margin: '0 0 4px 0', fontWeight: 400, fontSize: '14px', color: 'inherit', textDecoration: 'underline', display: 'inline-block', cursor: 'pointer' }}
                        >
                          {item.type === 'text' 
                            ? (item.file_name?.length > 50 ? item.file_name.substring(0, 50) + "..." : item.file_name) 
                            : (item.file_name || 'Unnamed File')}
                        </span>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                          {item.type === 'text' ? 'Text Note' : (item.file_size ? `${(parseInt(item.file_size) / 1024).toFixed(2)} KB` : '')} 
                          {(item.type === 'text' || item.file_size) && item.created_at ? ' • ' : ''} 
                          {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                        </p>
                      </div>
                      {item.type === 'text' ? (
                        <button 
                          className="btn"
                          onClick={() => handleCopy(item)}
                          disabled={copiedId === item.id}
                          style={{ padding: '6px 12px', fontSize: '13px', background: 'transparent', color: 'inherit', border: '1px solid currentColor', borderRadius: '4px' }}
                        >
                          {copiedId === item.id ? 'Copied!' : 'Copy'}
                        </button>
                      ) : (
                        <button 
                          className="btn"
                          onClick={() => handleSave(item)}
                          disabled={savingId === item.id}
                          style={{ padding: '6px 12px', fontSize: '13px', background: 'transparent', color: 'inherit', border: '1px solid currentColor', borderRadius: '4px' }}
                        >
                          {savingId === item.id ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
