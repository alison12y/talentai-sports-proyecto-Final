function TeamsPage() {
  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Planteles</p>
          <h1>Equipos</h1>
          <p>Organiza equipos por club, categoria deportiva y temporada activa.</p>
        </div>
        <button type="button" className="button-primary">Nuevo equipo</button>
      </div>

      <div className="table-placeholder">
        <div>
          <strong>Listado de equipos</strong>
          <p>Preparado para mostrar filtros, categorias y acciones de equipo.</p>
        </div>
        <span className="status-pill">Categorias</span>
      </div>
    </section>
  )
}

export default TeamsPage
