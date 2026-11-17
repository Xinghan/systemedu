export default function Image({ fill, priority, unoptimized, quality, loader, sizes, ...props }: any) { return <img {...props} style={{maxWidth:'100%', height:'auto', ...props.style}}/> }
