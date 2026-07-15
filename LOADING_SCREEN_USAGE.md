# Uso del Componente LoadingScreen

El componente `LoadingScreen` proporciona una pantalla de carga moderna y atractiva con animación de cartas estilo tarot educativo.

## Características

- ✨ Animación 3D de cartas con efecto de profundidad
- 🎨 8 cartas temáticas educativas con iconos y gradientes
- 🔄 Animación automática en bucle
- 📱 Diseño responsive y fullscreen
- 🎯 Mensajes personalizables
- 🌈 Fondo con gradientes animados

## Instalación

El componente ya está disponible en:
- `src/components/ui/loading-screen.tsx`
- `src/components/ui/page-loader.tsx` (wrapper simplificado)
- `src/hooks/useLoadingScreen.ts` (hook opcional)

## Uso Básico

### Opción 1: Usando PageLoader (Recomendado para páginas completas)

```tsx
import { PageLoader } from '@/components/ui/page-loader';

export const MiComponente = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar datos
    loadData().then(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageLoader message="Cargando datos..." />;
  }

  return <div>Contenido cargado</div>;
};
```

### Opción 2: Usando LoadingScreen directamente

```tsx
import { LoadingScreen } from '@/components/ui/loading-screen';

export const MiComponente = () => {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return (
      <LoadingScreen 
        message="Cargando información..." 
        fullScreen={true} 
      />
    );
  }

  return <div>Contenido</div>;
};
```

### Opción 3: LoadingScreen embebido (no fullscreen)

```tsx
import { LoadingScreen } from '@/components/ui/loading-screen';

export const MiComponente = () => {
  const [loading, setLoading] = useState(true);

  return (
    <div className="container mx-auto p-6">
      {loading ? (
        <LoadingScreen 
          message="Cargando..." 
          fullScreen={false} 
        />
      ) : (
        <div>Contenido</div>
      )}
    </div>
  );
};
```

### Opción 4: Usando el Hook (Para control más avanzado)

```tsx
import { useLoadingScreen } from '@/hooks/useLoadingScreen';
import { LoadingScreen } from '@/components/ui/loading-screen';

export const MiComponente = () => {
  const { loadingState, showLoading, hideLoading } = useLoadingScreen();

  const handleAction = async () => {
    showLoading('Procesando solicitud...');
    try {
      await processData();
    } finally {
      hideLoading();
    }
  };

  return (
    <>
      <button onClick={handleAction}>Procesar</button>
      
      {loadingState.isLoading && (
        <LoadingScreen 
          message={loadingState.message}
          fullScreen={true}
        />
      )}
    </>
  );
};
```

## Props del Componente

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `message` | `string` | No | `'Cargando...'` | Mensaje a mostrar debajo de las cartas |
| `fullScreen` | `boolean` | No | `true` | Si es `true`, ocupa toda la pantalla con `position: fixed` |

## Cartas Disponibles

El componente incluye 8 cartas temáticas educativas:

1. 📚 **Aprendizaje** - Azul
2. 🧮 **Matemáticas** - Verde
3. 💡 **Innovación** - Amarillo
4. 🌍 **Conocimiento** - Morado
5. 🎓 **Educación** - Índigo
6. 🏫 **Escuela** - Rojo
7. 🏆 **Excelencia** - Ámbar
8. 🎯 **Objetivos** - Teal

## Componentes que ya lo usan

- ✅ `Dashboard.tsx` - Carga de estadísticas
- ✅ `IncidentsList.tsx` - Carga de incidencias
- ✅ `ParentPortal.tsx` - Carga de información del estudiante

## Personalización

### Cambiar el mensaje

```tsx
<PageLoader message="Espere mientras cargamos los datos..." />
```

### Cambiar cartas

Edita el array `cards` en `src/components/ui/loading-screen.tsx`:

```tsx
const cards: CardData[] = [
  { 
    icon: BookOpen, 
    title: 'Aprendizaje', 
    color: 'from-blue-500 to-blue-700', 
    gradient: 'bg-gradient-to-br from-blue-500 to-blue-700' 
  },
  // Agrega más cartas aquí...
];
```

### Cambiar velocidad de animación

Modifica el intervalo en el `useEffect`:

```tsx
const interval = setInterval(() => {
  // ...
}, 4000); // Cambia este valor (en milisegundos)
```

### Cambiar colores de fondo

Modifica las clases de Tailwind en el componente:

```tsx
<div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
  {/* Cambia 'from-slate-900' por otros colores */}
</div>
```

## Notas Técnicas

- El componente usa `@react-spring/web` para animaciones suaves
- Las cartas se animan con transformaciones 3D CSS
- El componente es completamente responsive
- El z-index es `9999` cuando está en modo fullscreen
- Las animaciones se reinician automáticamente cada 4 segundos

## Ejemplos de Uso en Diferentes Contextos

### Carga inicial de página

```tsx
if (loading) {
  return <PageLoader message="Cargando página..." />;
}
```

### Carga de datos específicos

```tsx
if (loading) {
  return <PageLoader message="Cargando incidencias..." />;
}
```

### Procesamiento de formulario

```tsx
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  setSubmitting(true);
  try {
    await submitForm();
  } finally {
    setSubmitting(false);
  }
};

{submitting && <PageLoader message="Guardando datos..." />}
```

## Mejores Prácticas

1. **Mensajes descriptivos**: Use mensajes que indiquen qué se está cargando
2. **Tiempo mínimo**: Considere mostrar el loader solo si la carga toma más de 300ms
3. **Fullscreen para páginas**: Use `fullScreen={true}` para cargas de página completa
4. **Embebido para secciones**: Use `fullScreen={false}` para cargas de secciones específicas

