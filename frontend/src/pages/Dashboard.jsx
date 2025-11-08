import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import "./Dashboard.css";

const Dashboard = () => {
  const svgRef = useRef(null);
  const [status, setStatus] = useState("Cargando...");
  const [error, setError] = useState(null);
  const [tipoMapa, setTipoMapa] = useState("poblacion");

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      impactoSocial: formData.get('impacto-social'),
      impactoEconomico: formData.get('impacto-economico'),
      edadMin: formData.get('edad-min'),
      edadMax: formData.get('edad-max'),
      tipoMapa: tipoMapa
    }; 
  };

  const [mapInfo, setMapInfo] = useState({});

  useEffect(() => {
    const containerWidth = svgRef.current.parentElement.clientWidth;
    const containerHeight = svgRef.current.parentElement.clientHeight;
    const width = containerWidth || 1400;
    const height = containerHeight || 900;
 
    d3.select(svgRef.current).selectAll("*").remove();
 
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("width", "100%")
      .attr("height", "100%")
      .style("background", "#cfd3d4")
      .style("border-radius", "15px");
 
    const mainGroup = svg.append("g").attr("class", "main-group");
 
    svg.call(d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]]) 
        .on("zoom", (event) => { 
          mainGroup.attr("transform", event.transform);
        })
      )
      .on("dblclick.zoom", null);  
 
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "map-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.8)")
      .style("color", "white")
      .style("padding", "10px 15px")
      .style("border-radius", "8px")
      .style("font-size", "14px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000)
      .style("box-shadow", "0 2px 10px rgba(0,0,0,0.3)")
      .style("transition", "opacity 0.2s");
 
    const loadingText = svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", "24px")
      .attr("fill", "#666")
      .text("Cargando mapa de España...");
 
    const url = "https://cdn.jsdelivr.net/npm/es-atlas/es/municipalities.json"; 
    
    d3.json(url)
      .then(es => { 
        /*
        fetch(await import.meta.env.VITE_API_URL + '/data/municipios_enriched.geojson')
          .then(response => response.json())
          .then(data => {
            setMapInfo(prev => ({
              ...prev,
              nombre: es.properties.name,
              num_oficina: es.properties.num_oficina,
              tiene_oficina: es.properties.tiene_oficina,
              sueldo_medio: es.properties.sueldo_medio,
              precio_alquiler: es.properties.precio_alquiler,
              edad_media: es.properties.edad_media,
              incremento_poblacion: es.properties.incremento_poblacion, 
              poblacion: es.properties.poblacion
        }));
        */
        loadingText.text("Procesando municipios...");
        setStatus("Procesando municipios...");
         
        const municipalities = topojson.feature(es, es.objects.municipalities);
        const national = topojson.merge(es, es.objects.municipalities.geometries);

        loadingText.remove();
        setStatus(`${municipalities.features.length} municipios cargados`);
  
        const canarias = municipalities.features.filter(d => {
          const centroid = d3.geoCentroid(d);
          const lon = centroid[0];
          const lat = centroid[1]; 
          return lon < -13 && lon > -19 && lat > 27 && lat < 30;
        });
        
        const peninsula = municipalities.features.filter(d => {
          const centroid = d3.geoCentroid(d);
          const lon = centroid[0];
          const lat = centroid[1];
          return !(lon < -13 && lon > -19 && lat > 27 && lat < 30);
        });

        const peninsulaCollection = {
          type: "FeatureCollection",
          features: peninsula
        };
  
        const projection = d3.geoIdentity()
          .reflectY(true)
          .fitExtent([[30, 30], [width - 30, height - 30]], peninsulaCollection);

        const path = d3.geoPath(projection);
   
        svg.on("click", function(event) { 
          if (event.target.tagName === 'svg') {
            const [x, y] = d3.pointer(event);
            svg.transition().duration(750).call(
              d3.zoom().transform,
              d3.zoomIdentity.translate(width / 2, height / 2).scale(2).translate(-x, -y)
            );
          }
        });

        mainGroup
          .selectAll("path")
          .data(peninsula)
          .join("path")
          .attr("fill", "white")
          .attr("d", path)
          .attr("stroke", "black") 
          .attr("stroke-width", 0.2)
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("fill", "#FFC107")
              .attr("stroke-width", 1);
            
            const municipioName = d.properties.name || d.properties.NAME_2;
            
            tooltip
              .html(`
                <strong>${municipioName}</strong><br/>
                Provincia: ${d.properties.province || 'N/A'}
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px")
              .style("opacity", 1);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("fill", "white")
              .attr("stroke-width", 0.2);
            
            tooltip.style("opacity", 0);
          });
  
        const canariasCollection = {
          type: "FeatureCollection",
          features: canarias
        };
 
        const canariasProjection = d3.geoIdentity()
          .reflectY(true)
          .fitSize([180, 130], canariasCollection);  

        const canariasPath = d3.geoPath(canariasProjection);
 
        const canariasGroup = mainGroup.append("g")
          .attr("class", "canarias-group")
          .attr("transform", "translate(" + (10) + ", " + (height - 130) + ")");
  
        canariasGroup.append("line")
          .attr("x1", -20)
          .attr("y1", -5)
          .attr("x2", 185)
          .attr("y2", -5)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
        
        canariasGroup.append("line")
          .attr("x1", 185)
          .attr("y1", -5)
          .attr("x2", 185)
          .attr("y2", 135)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
 
        canariasGroup.selectAll("path")
          .data(canarias)
          .join("path")
          .attr("fill", "white")
          .attr("d", canariasPath)
          .attr("stroke", "black")
          .attr("stroke-width", 0.3)
          .on("mouseover", function(event, d) {
            d3.select(this)
              .attr("fill", "#FFC107")
              .attr("stroke-width", 1);
            
            const municipioName = d.properties.name || d.properties.NAME_2;
            
            tooltip
              .html(`<strong>${municipioName}</strong><br/>📍 Islas Canarias`)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px")
              .style("opacity", 1);
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY - 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this)
              .attr("fill", "white")
              .attr("stroke-width", 0.3);
            
            tooltip.style("opacity", 0);
          });
 
        canariasGroup.append("text")
          .attr("x", 100)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("font-weight", "bold") ;

      })
      .catch(error => { 
        
        loadingText
          .attr("fill", "red")
          .text(`Error: ${error.message}`);
        
        setError(error.message);
        setStatus("Error al cargar el mapa");
      });
 
    return () => {
      d3.selectAll(".map-tooltip").remove();
    };

  }, []);

  return (
    <div className="dashboard-container">
      <nav className="dashboard-header" style={{
        border: '2px solid #363636f9',
        margin: '15px',
        borderRadius: '10px'
      }}>
        <h1>Dashboard de Municipios de España</h1>
        <p>{status}</p>
      </nav>
      
      {error && (
        <div className="dashboard-error">
          Error: {error}
        </div>
      )}
      <div style={{
        flex: 1,
        display: 'flex',
        margin: '0 15px 15px 15px',
      }}>
        <div className="dashboard-map-container" style={{ position: 'relative' }}>
          <svg ref={svgRef}></svg>
          
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'white',
            padding: '15px',
            borderRadius: '10px',
            border: '2px solid #363636f9',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: 10
          }}>
            <label htmlFor="tipo-mapa" style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Tipo de Mapa
            </label>
            <select 
              id="tipo-mapa"
              value={tipoMapa}
              onChange={(e) => setTipoMapa(e.target.value)}
              style={{
                width: '200px',
                padding: '8px',
                borderRadius: '5px',
                border: '1px solid #ccc',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="numero_oficinas">Número de oficinas</option>
              <option value="sueldo_medio">Sueldo medio</option>
              <option value="precio_alquiler">Precio alquiler medio</option>
              <option value="edad_media">Edad media</option>
              <option value="poblacion">Población</option>
              <option value="incremento_poblacion">Incremento población</option>
            </select>
          </div>

        </div>
        <div style={{
          marginLeft: '15px',
          border: '2px solid #363636f9',
          borderRadius: '10px',
          width: '25%',
          backgroundColor: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', padding: '10px 20px' }}>Información del Municipio</h2>
          <form action="" style={{ padding: '10px 20px' }} onSubmit={handleSubmit}>
            
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="impacto-social-slider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Impacto social</span>
                <span className="social-output" style={{ fontWeight: '700' }}>50%</span>
              </label>
              <input
                id="impacto-social-slider"
                name="impacto-social"
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                onInput={(e) => {
                  const v = e.target.value;
                  const form = e.target.closest('form');
                  const out = form && form.querySelector('.social-output');
                  if (out) out.textContent = v + '%'; 
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="impacto-economico-slider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Impacto económico</span>
                <span className="economic-output" style={{ fontWeight: '700' }}>50%</span>
              </label>
              <input
                id="impacto-economico-slider"
                name="impacto-economico"
                type="range"
                min="0"
                max="100"
                defaultValue="50"
                onInput={(e) => {
                  const v = e.target.value;
                  const form = e.target.closest('form');
                  const out = form && form.querySelector('.economic-output');
                  if (out) out.textContent = v + '%'; 
                }}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="rango-edad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>Rango de edad</span>
                <span className="edad-output" style={{ fontWeight: '700' }}>18-65 años</span>
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  id="edad-min"
                  name="edad-min"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="18"
                  onInput={(e) => {
                    const form = e.target.closest('form');
                    const minVal = e.target.value;
                    const maxVal = form.querySelector('#edad-max').value;
                    const out = form && form.querySelector('.edad-output');
                    if (out) out.textContent = `${minVal}-${maxVal} años`;
                  }}
                  style={{ width: '45%', padding: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
                <span>-</span>
                <input
                  id="edad-max"
                  name="edad-max"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue="65"
                  onInput={(e) => {
                    const form = e.target.closest('form');
                    const minVal = form.querySelector('#edad-min').value;
                    const maxVal = e.target.value;
                    const out = form && form.querySelector('.edad-output');
                    if (out) out.textContent = `${minVal}-${maxVal} años`;
                  }}
                  style={{ width: '45%', padding: '5px', borderRadius: '5px', border: '1px solid #ccc' }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#363636f9',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.3s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4a4a4a'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#363636f9'}
            >
              Enviar
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
