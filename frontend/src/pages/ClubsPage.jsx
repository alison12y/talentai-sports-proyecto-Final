function ClubsPage() {
  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Gestion</p>
          <h1>Clubes</h1>
          <p>Administra academias, datos institucionales, configuracion y plan SaaS.</p>
        </div>
        <button type="button" className="button-primary">Nuevo club</button>
      </div>

      <div className="table-placeholder">
        <div>
          <strong>Listado de clubes</strong>
          <p>Este espacio queda preparado para conectar el CRUD visual de clubes.</p>
        </div>
        <span className="status-pill">Sprint 1</span>
      </div>
    </section>
  )
}

export default ClubsPage
