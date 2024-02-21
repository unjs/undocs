import { trainCase } from 'scule'

export function toLabel(key: string) {
  let label = trainCase(key).replaceAll('-', ' ')
  if (label === 'Api') {
    label = 'API'
  }
  return label
}
