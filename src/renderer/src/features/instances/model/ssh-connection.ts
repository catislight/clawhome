export type SshConnectionFormValues = {
  title: string
  connectionType?: 'ssh' | 'local'
  port: number
  host: string
  username: string
  password: string
  privateKey: string
  privateKeyPassphrase?: string
  gatewayToken?: string
  gatewayPassword?: string
  gatewayOrigin?: string
  gatewayHost?: string
  gatewayPort?: number
  gatewayPath?: string
}
